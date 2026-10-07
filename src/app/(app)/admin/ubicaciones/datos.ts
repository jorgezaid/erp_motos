import 'server-only';
import { TIPO_UBICACION } from '@/lib/etiquetas';
import { createClient } from '@/lib/supabase/server';
import { filtroBusqueda, MAX_FILAS_CSV, rango, valorPermitido, type ColumnaCsv, type ParamsTabla } from '@/lib/tabla';
import type { Database } from '@/types/database';

export type FilaUbicacion = Database['public']['Tables']['locations']['Row'];
type Tipo = Database['public']['Enums']['location_type'];

export const ESTADOS_UBICACION = [
  { valor: 'activo', etiqueta: 'Activas' },
  { valor: 'inactivo', etiqueta: 'Inactivas' },
];

export async function consultarUbicaciones(
  { q, estado, pagina, tipo }: ParamsTabla & { tipo?: string },
  { todas = false }: { todas?: boolean } = {},
) {
  const supabase = await createClient();
  let consulta = supabase.from('locations').select('*', { count: 'exact' }).order('nombre');
  const or = filtroBusqueda(q, ['nombre', 'direccion']);
  if (or) consulta = consulta.or(or);
  if (estado === 'activo') consulta = consulta.eq('activo', true);
  if (estado === 'inactivo') consulta = consulta.eq('activo', false);
  const t = valorPermitido(tipo ?? '', Object.keys(TIPO_UBICACION) as Tipo[]);
  if (t) consulta = consulta.eq('tipo', t);

  const [desde, hasta] = todas ? [0, MAX_FILAS_CSV - 1] : rango(pagina);
  const { data, count, error } = await consulta.range(desde, hasta);
  if (error) throw new Error(error.message);
  return { filas: data, total: count ?? 0 };
}

export const COLUMNAS_CSV: ColumnaCsv<FilaUbicacion>[] = [
  { encabezado: 'Nombre', valor: (u) => u.nombre },
  { encabezado: 'Tipo', valor: (u) => TIPO_UBICACION[u.tipo] },
  { encabezado: 'Dirección', valor: (u) => u.direccion },
  { encabezado: 'Activa', valor: (u) => (u.activo ? 'Sí' : 'No') },
];
