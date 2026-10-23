import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { filtroBusqueda, MAX_FILAS_CSV, rango, type ColumnaCsv, type ParamsTabla } from '@/lib/tabla';
import type { Database } from '@/types/database';

export type FilaProveedor = Database['public']['Tables']['proveedores']['Row'] & { lotes: number };

export const ESTADOS_PROVEEDOR = [
  { valor: 'activo', etiqueta: 'Activos' },
  { valor: 'inactivo', etiqueta: 'Inactivos' },
];

/** Proveedores (D41, solo admin por RLS) con la cantidad de lotes de cada uno. */
export async function consultarProveedores({ q, estado, pagina }: ParamsTabla, { todas = false }: { todas?: boolean } = {}) {
  const supabase = await createClient();
  let consulta = supabase.from('proveedores').select('*, import_batches(count)', { count: 'exact' }).order('nombre');
  const or = filtroBusqueda(q, ['nombre', 'ruc', 'telefono']);
  if (or) consulta = consulta.or(or);
  if (estado === 'activo') consulta = consulta.eq('activo', true);
  if (estado === 'inactivo') consulta = consulta.eq('activo', false);

  const [desde, hasta] = todas ? [0, MAX_FILAS_CSV - 1] : rango(pagina);
  const { data, count, error } = await consulta.range(desde, hasta);
  if (error) throw new Error(error.message);
  const filas: FilaProveedor[] = data.map(({ import_batches, ...p }) => ({ ...p, lotes: import_batches[0]?.count ?? 0 }));
  return { filas, total: count ?? 0 };
}

export const COLUMNAS_CSV: ColumnaCsv<FilaProveedor>[] = [
  { encabezado: 'Nombre', valor: (p) => p.nombre },
  { encabezado: 'RUC', valor: (p) => p.ruc },
  { encabezado: 'Teléfono', valor: (p) => p.telefono },
  { encabezado: 'Lotes', valor: (p) => p.lotes },
  { encabezado: 'Activo', valor: (p) => (p.activo ? 'Sí' : 'No') },
];
