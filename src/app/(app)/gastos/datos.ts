import 'server-only';
import { Decimal } from '@/lib/decimal';
import { CATEGORIA_GASTO, ESTADO_GASTO, METODO_PAGO } from '@/lib/etiquetas';
import { formatFecha } from '@/lib/format';
import { etiquetaMes, filtroMes, mesDeGasto, type CategoriaGasto, type EstadoGasto } from '@/lib/gastos';
import { createClient } from '@/lib/supabase/server';
import { filtroBusqueda, MAX_FILAS_CSV, rango, valorPermitido, type ColumnaCsv, type ParamsTabla } from '@/lib/tabla';
import type { Database } from '@/types/database';

export type FilaGasto = Database['public']['Tables']['gastos']['Row'];

export const ESTADOS_GASTO = (Object.keys(ESTADO_GASTO) as EstadoGasto[]).map((valor) => ({
  valor,
  etiqueta: ESTADO_GASTO[valor],
}));

/** Filtros de la lista: búsqueda, estado, categoría y mes (null = todos los meses). */
export type FiltrosGastos = ParamsTabla & { categoria?: string; mes: string | null };

/**
 * Aplica los filtros a cualquier consulta sobre `gastos` (lista, totales y CSV). Varios `or` se
 * combinan con AND en PostgREST; estado y categoría solo pueden ser valores del enum.
 */
function filtrar<Q extends { or(filtros: string): Q }>(consulta: Q, { q, estado, categoria, mes }: FiltrosGastos): Q {
  let c = consulta;
  const busqueda = filtroBusqueda(q, ['descripcion', 'proveedor']);
  if (busqueda) c = c.or(busqueda);
  const e = valorPermitido(estado, Object.keys(ESTADO_GASTO) as EstadoGasto[]);
  if (e) c = c.or(`estado.eq.${e}`);
  const cat = valorPermitido(categoria ?? '', Object.keys(CATEGORIA_GASTO) as CategoriaGasto[]);
  if (cat) c = c.or(`categoria.eq.${cat}`);
  const delMes = mes ? filtroMes(mes) : null;
  if (delMes) c = c.or(delMes);
  return c;
}

export async function consultarGastos(filtros: FiltrosGastos, { todas = false }: { todas?: boolean } = {}) {
  const supabase = await createClient();
  const consulta = filtrar(supabase.from('gastos').select('*', { count: 'exact' }), filtros)
    .order('fecha', { ascending: false, nullsFirst: true })
    .order('fecha_estimada', { ascending: false })
    .order('created_at', { ascending: false });
  const [desde, hasta] = todas ? [0, MAX_FILAS_CSV - 1] : rango(filtros.pagina);
  const { data, count, error } = await consulta.range(desde, hasta);
  if (error) throw new Error(error.message);
  return { filas: data, total: count ?? 0 };
}

/** Estado, categoría y monto de todos los gastos filtrados (no solo la página), para los totales. */
export async function consultarMontos(filtros: FiltrosGastos) {
  const supabase = await createClient();
  const { data, error } = await filtrar(supabase.from('gastos').select('estado, categoria, monto_pen'), filtros).limit(MAX_FILAS_CSV);
  if (error) throw new Error(error.message);
  return data;
}

/** Todos los gastos planificados, por fecha estimada (para agruparlos por mes). */
export async function consultarPlanificados() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .eq('estado', 'planificado')
    .order('fecha_estimada')
    .limit(MAX_FILAS_CSV);
  if (error) throw new Error(error.message);
  return data;
}

/** Fechas de todos los gastos (para ofrecer en el filtro solo los meses con gastos). */
export async function consultarFechas(): Promise<(string | null)[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('gastos').select('fecha, fecha_estimada').limit(MAX_FILAS_CSV);
  if (error) throw new Error(error.message);
  return data.map((g) => g.fecha ?? g.fecha_estimada);
}

export const COLUMNAS_CSV: ColumnaCsv<FilaGasto>[] = [
  { encabezado: 'Mes', valor: (g) => { const m = mesDeGasto(g); return m ? etiquetaMes(m) : ''; } },
  { encabezado: 'Estado', valor: (g) => ESTADO_GASTO[g.estado] },
  { encabezado: 'Fecha de pago', valor: (g) => (g.fecha ? formatFecha(g.fecha) : '') },
  { encabezado: 'Fecha estimada', valor: (g) => (g.fecha_estimada ? formatFecha(g.fecha_estimada) : '') },
  { encabezado: 'Categoría', valor: (g) => CATEGORIA_GASTO[g.categoria] },
  { encabezado: 'Descripción', valor: (g) => g.descripcion },
  { encabezado: 'Proveedor', valor: (g) => g.proveedor },
  { encabezado: 'Monto (S/)', valor: (g) => new Decimal(g.monto_pen).toFixed(2) },
  { encabezado: 'Método de pago', valor: (g) => (g.metodo_pago ? METODO_PAGO[g.metodo_pago] : '') },
  { encabezado: 'Comprobante', valor: (g) => (g.comprobante_path ? 'Sí' : 'No') },
];
