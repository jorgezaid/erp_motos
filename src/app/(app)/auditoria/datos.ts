import 'server-only';
import { z } from 'zod';
import { exigirRol } from '@/lib/auth';
import { TIPO_LOTE, type TipoLote } from '@/lib/etiquetas';
import { alertasConciliacion, tieneAlertas } from '@/lib/auditoria';
import { claveLoteModelo, motosSinSerialRealPorLote } from '@/lib/consultas/provisionales';
import { rangoLima, type FilaMargen } from '@/lib/margenes';
import { createClient } from '@/lib/supabase/server';
import { MAX_FILAS_CSV, valorPermitido } from '@/lib/tabla';
import type { Database } from '@/types/database';

export type FilaConciliacion = Database['public']['Views']['v_batch_reconciliation']['Row'];

export const VISTAS = ['conciliacion', 'ventas', 'modelos'] as const;
export type Vista = (typeof VISTAS)[number];

type SP = Record<string, string | string[] | undefined>;
const texto = (v: string | string[] | undefined) => (typeof v === 'string' ? v.trim().slice(0, 60) : '');

export function leerFiltrosAuditoria(sp: SP) {
  const vista = (VISTAS as readonly string[]).includes(texto(sp.vista)) ? (texto(sp.vista) as Vista) : 'conciliacion';
  return {
    vista,
    q: texto(sp.q),
    estado: texto(sp.estado),
    desde: texto(sp.desde),
    hasta: texto(sp.hasta),
    origen: texto(sp.origen),
    proveedor: texto(sp.proveedor),
  };
}

/** Conciliación de todos los lotes (v_batch_reconciliation, solo admin). */
export async function consultarConciliacion({ q, estado }: { q: string; estado: string }) {
  await exigirRol('admin');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_batch_reconciliation')
    .select('*')
    .order('codigo_embarque')
    .order('codigo_modelo')
    .limit(MAX_FILAS_CSV);
  if (error) throw new Error(error.message);
  const sinSerial = await motosSinSerialRealPorLote();
  const t = q.toLowerCase();
  return data
    .map((f) => ({ ...f, motos_sin_serial_real: sinSerial.get(claveLoteModelo(f.batch_id, f.codigo_modelo)) ?? 0 }))
    .filter((f) => !t || (f.codigo_embarque ?? '').toLowerCase().includes(t) || (f.codigo_modelo ?? '').toLowerCase().includes(t))
    .filter((f) => (estado === 'alertas' ? tieneAlertas(f) : estado === 'ok' ? !tieneAlertas(f) : true))
    .map((f) => ({ ...f, alertas: alertasConciliacion(f) }));
}

/**
 * Margen real por unidad vendida (v_sales_margin, solo admin) en el rango de fechas de Lima,
 * opcionalmente solo de un origen o de un proveedor (D41).
 */
export async function consultarMargenes({
  q,
  desde,
  hasta,
  origen,
  proveedor,
}: {
  q: string;
  desde: string;
  hasta: string;
  origen: string;
  proveedor: string;
}): Promise<FilaMargen[]> {
  await exigirRol('admin');
  const supabase = await createClient();
  const r = rangoLima(desde || null, hasta || null);
  let consulta = supabase.from('v_sales_margin').select('*').order('numero', { ascending: false }).limit(MAX_FILAS_CSV);
  if (r.desde) consulta = consulta.gte('confirmada_at', r.desde);
  if (r.hasta) consulta = consulta.lt('confirmada_at', r.hasta);
  const o = valorPermitido(origen, Object.keys(TIPO_LOTE) as TipoLote[]);
  if (o) consulta = consulta.eq('tipo_lote', o);
  if (z.uuid().safeParse(proveedor).success) consulta = consulta.eq('proveedor_id', proveedor);
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  const t = q.toLowerCase();
  return data.filter(
    (f) => !t || (f.codigo_modelo ?? '').toLowerCase().includes(t) || (f.cliente_nombre ?? '').toLowerCase().includes(t),
  );
}
