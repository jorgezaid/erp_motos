import 'server-only';
import { z } from 'zod';
import { CATEGORIA, ESTADO_UNIDAD, opciones, TIPO_LOTE, type TipoLote } from '@/lib/etiquetas';
import type { Categoria } from '@/lib/modelos';
import { createClient } from '@/lib/supabase/server';
import { PREFIJO_PROVISIONAL } from '@/lib/taller';
import { filtroBusqueda, MAX_FILAS_CSV, rango, valorPermitido, type ColumnaCsv, type ParamsTabla } from '@/lib/tabla';
import type { Database } from '@/types/database';

/**
 * Stock sobre `v_stock` (sin costos; los precios solo llegan si el rol puede verlos por RLS).
 * Lo usan /inventario, la pestaña Unidades del lote y el taller.
 */
export type FilaStock = Database['public']['Views']['v_stock']['Row'] & {
  /** D37: baterías con serial provisional (PROV-) */
  baterias_provisionales: number;
};
type Estado = Database['public']['Enums']['vehicle_status'];

export const ESTADOS: Estado[] = Object.keys(ESTADO_UNIDAD) as Estado[];

export type FiltrosStock = ParamsTabla & {
  batchId?: string;
  modelo?: string;
  categoria?: string;
  ubicacion?: string;
  color?: string;
  /** Solo estos estados (p. ej. la cola del taller) */
  estados?: Estado[];
  /** D37: `provisionales` = solo «Baterías sin serial real» */
  baterias?: string;
  /** D41: importación o compra local (todos los roles) */
  origen?: string;
  /** D41: id del proveedor. Solo para el admin: el RLS de import_batches no deja resolverlo a otro rol */
  proveedor?: string;
};

/** D41: filtro por origen del lote (el proveedor nunca se ofrece al vendedor ni al técnico). */
export const OPCION_FILTRO_ORIGEN = { param: 'origen', etiqueta: 'Origen', opciones: opciones(TIPO_LOTE) };

/** D37: valor del filtro `?baterias=` para las motos con seriales PROV-. */
export const FILTRO_SIN_SERIAL_REAL = 'provisionales';
export const OPCION_FILTRO_BATERIAS = {
  param: 'baterias',
  etiqueta: 'Baterías',
  opciones: [{ valor: FILTRO_SIN_SERIAL_REAL, etiqueta: 'Sin serial real' }],
};

type Cliente = Awaited<ReturnType<typeof createClient>>;

/** D37: baterías provisionales por unidad (de `ids`, o de todas si no se indica). */
async function contarProvisionales(supabase: Cliente, ids?: string[]): Promise<Map<string, number>> {
  let consulta = supabase.from('vehicle_batteries').select('vehicle_id').ilike('serial', `${PREFIJO_PROVISIONAL}%`);
  if (ids) consulta = consulta.in('vehicle_id', ids);
  const { data, error } = await consulta.limit(MAX_FILAS_CSV * 6);
  if (error) throw new Error(error.message);
  const conteo = new Map<string, number>();
  for (const b of data) conteo.set(b.vehicle_id, (conteo.get(b.vehicle_id) ?? 0) + 1);
  return conteo;
}

export async function consultarStock(f: FiltrosStock, { todas = false }: { todas?: boolean } = {}) {
  const supabase = await createClient();
  let consulta = supabase.from('v_stock').select('*', { count: 'exact' }).order('codigo_modelo').order('vin_chasis');

  const or = filtroBusqueda(f.q, ['vin_chasis', 'nro_motor', 'codigo_modelo']);
  if (or) consulta = consulta.or(or);
  const estado = valorPermitido(f.estado, ESTADOS);
  if (estado) consulta = consulta.eq('estado', estado);
  if (f.estados?.length) consulta = consulta.in('estado', f.estados);
  if (f.batchId) consulta = consulta.eq('batch_id', f.batchId);
  if (f.modelo) consulta = consulta.eq('codigo_modelo', f.modelo);
  const categoria = valorPermitido(f.categoria ?? '', Object.keys(CATEGORIA) as Categoria[]);
  if (categoria) consulta = consulta.eq('categoria', categoria);
  if (f.ubicacion) consulta = consulta.eq('ubicacion', f.ubicacion);
  const origen = valorPermitido(f.origen ?? '', Object.keys(TIPO_LOTE) as TipoLote[]);
  if (origen) consulta = consulta.eq('tipo_lote', origen);
  if (f.proveedor && z.uuid().safeParse(f.proveedor).success) {
    const { data: lotes, error } = await supabase.from('import_batches').select('id').eq('proveedor_id', f.proveedor);
    if (error) throw new Error(error.message);
    consulta = consulta.in('batch_id', lotes.map((l) => l.id));
  }
  if (f.baterias === FILTRO_SIN_SERIAL_REAL) {
    consulta = consulta.in('vehicle_id', [...(await contarProvisionales(supabase)).keys()]);
  }
  if (f.color) {
    const c = f.color.replace(/[,()*:"\\%_]/g, '');
    if (c) consulta = consulta.or(`color_primario.ilike.${c},color_secundario.ilike.${c}`);
  }

  const [desde, hasta] = todas ? [0, MAX_FILAS_CSV - 1] : rango(f.pagina);
  const { data, count, error } = await consulta.range(desde, hasta);
  if (error) throw new Error(error.message);
  const ids = data.flatMap((d) => d.vehicle_id ?? []);
  const provisionales = ids.length ? await contarProvisionales(supabase, ids) : new Map<string, number>();
  const filas: FilaStock[] = data.map((d) => ({ ...d, baterias_provisionales: provisionales.get(d.vehicle_id ?? '') ?? 0 }));
  return { filas, total: count ?? 0 };
}

export function textoInspeccion(aprobada: boolean | null): string {
  return aprobada === null ? 'Sin inspección' : aprobada ? 'Aprobada' : 'Observada';
}

export const COLUMNAS_CSV_STOCK: ColumnaCsv<FilaStock>[] = [
  { encabezado: 'VIN', valor: (s) => s.vin_chasis },
  { encabezado: 'Motor', valor: (s) => s.nro_motor },
  { encabezado: 'Modelo', valor: (s) => s.codigo_modelo },
  { encabezado: 'Origen', valor: (s) => (s.tipo_lote ? TIPO_LOTE[s.tipo_lote] : '') },
  { encabezado: 'Voltaje (V)', valor: (s) => s.voltaje_sistema },
  { encabezado: 'Color 1', valor: (s) => s.color_primario },
  { encabezado: 'Color 2', valor: (s) => s.color_secundario },
  { encabezado: 'Estado', valor: (s) => (s.estado ? ESTADO_UNIDAD[s.estado] : '') },
  { encabezado: 'Ubicación', valor: (s) => s.ubicacion },
  { encabezado: 'Baterías', valor: (s) => `${s.baterias_registradas ?? 0}/${s.cantidad_baterias_12v ?? 0}` },
  { encabezado: 'Inspección', valor: (s) => textoInspeccion(s.ultima_inspeccion_aprobada) },
  { encabezado: 'Baterías sin serial real', valor: (s) => s.baterias_provisionales },
];
