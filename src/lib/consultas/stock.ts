import 'server-only';
import { ESTADO_UNIDAD } from '@/lib/etiquetas';
import { createClient } from '@/lib/supabase/server';
import { filtroBusqueda, MAX_FILAS_CSV, rango, valorPermitido, type ColumnaCsv, type ParamsTabla } from '@/lib/tabla';
import type { Database } from '@/types/database';

/**
 * Stock sobre `v_stock` (sin costos; los precios solo llegan si el rol puede verlos por RLS).
 * Lo usan /inventario, la pestaña Unidades del lote y el taller.
 */
export type FilaStock = Database['public']['Views']['v_stock']['Row'];
type Estado = Database['public']['Enums']['vehicle_status'];

export const ESTADOS: Estado[] = Object.keys(ESTADO_UNIDAD) as Estado[];

export type FiltrosStock = ParamsTabla & {
  batchId?: string;
  modelo?: string;
  ubicacion?: string;
  color?: string;
  /** Solo estos estados (p. ej. la cola del taller) */
  estados?: Estado[];
};

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
  if (f.ubicacion) consulta = consulta.eq('ubicacion', f.ubicacion);
  if (f.color) {
    const c = f.color.replace(/[,()*:"\\%_]/g, '');
    if (c) consulta = consulta.or(`color_primario.ilike.${c},color_secundario.ilike.${c}`);
  }

  const [desde, hasta] = todas ? [0, MAX_FILAS_CSV - 1] : rango(f.pagina);
  const { data, count, error } = await consulta.range(desde, hasta);
  if (error) throw new Error(error.message);
  return { filas: data, total: count ?? 0 };
}

export function textoInspeccion(aprobada: boolean | null): string {
  return aprobada === null ? 'Sin inspección' : aprobada ? 'Aprobada' : 'Observada';
}

export const COLUMNAS_CSV_STOCK: ColumnaCsv<FilaStock>[] = [
  { encabezado: 'VIN', valor: (s) => s.vin_chasis },
  { encabezado: 'Motor', valor: (s) => s.nro_motor },
  { encabezado: 'Modelo', valor: (s) => s.codigo_modelo },
  { encabezado: 'Voltaje (V)', valor: (s) => s.voltaje_sistema },
  { encabezado: 'Color 1', valor: (s) => s.color_primario },
  { encabezado: 'Color 2', valor: (s) => s.color_secundario },
  { encabezado: 'Estado', valor: (s) => (s.estado ? ESTADO_UNIDAD[s.estado] : '') },
  { encabezado: 'Ubicación', valor: (s) => s.ubicacion },
  { encabezado: 'Baterías', valor: (s) => `${s.baterias_registradas ?? 0}/${s.cantidad_baterias_12v ?? 0}` },
  { encabezado: 'Inspección', valor: (s) => textoInspeccion(s.ultima_inspeccion_aprobada) },
];
