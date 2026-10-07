import 'server-only';
import { CATEGORIA } from '@/lib/etiquetas';
import { createClient } from '@/lib/supabase/server';
import { filtroBusqueda, MAX_FILAS_CSV, rango, valorPermitido, type ColumnaCsv, type ParamsTabla } from '@/lib/tabla';
import type { Database } from '@/types/database';

export type FilaModelo = Database['public']['Tables']['vehicle_models']['Row'];
type Categoria = Database['public']['Enums']['vehicle_category'];

export const ESTADOS_MODELO = [
  { valor: 'activo', etiqueta: 'Activos' },
  { valor: 'inactivo', etiqueta: 'Inactivos' },
];

const CATEGORIAS = Object.keys(CATEGORIA) as Categoria[];

export async function consultarModelos(
  { q, estado, pagina, categoria }: ParamsTabla & { categoria?: string },
  { todas = false }: { todas?: boolean } = {},
) {
  const supabase = await createClient();
  let consulta = supabase.from('vehicle_models').select('*', { count: 'exact' }).order('codigo_modelo');

  const or = filtroBusqueda(q, ['codigo_modelo', 'nombre_comercial']);
  if (or) consulta = consulta.or(or);
  if (estado === 'activo') consulta = consulta.eq('activo', true);
  if (estado === 'inactivo') consulta = consulta.eq('activo', false);
  const cat = valorPermitido(categoria ?? '', CATEGORIAS);
  if (cat) consulta = consulta.eq('categoria', cat);

  const [desde, hasta] = todas ? [0, MAX_FILAS_CSV - 1] : rango(pagina);
  const { data, count, error } = await consulta.range(desde, hasta);
  if (error) throw new Error(error.message);
  return { filas: data, total: count ?? 0 };
}

export const COLUMNAS_CSV: ColumnaCsv<FilaModelo>[] = [
  { encabezado: 'Código', valor: (m) => m.codigo_modelo },
  { encabezado: 'Nombre comercial', valor: (m) => m.nombre_comercial },
  { encabezado: 'Categoría', valor: (m) => CATEGORIA[m.categoria] },
  { encabezado: 'Voltaje (V)', valor: (m) => m.voltaje_sistema },
  { encabezado: 'Baterías 12V', valor: (m) => m.cantidad_baterias_12v },
  { encabezado: 'Amperaje (Ah)', valor: (m) => m.amperaje_bateria_ah },
  { encabezado: 'Potencia (W)', valor: (m) => m.potencia_motor_watts },
  { encabezado: 'CBM unitario', valor: (m) => m.volumen_cbm_unitario },
  { encabezado: 'EXW unitario (US$)', valor: (m) => m.exw_usd_unitario },
  { encabezado: 'Garantía (meses)', valor: (m) => m.garantia_meses },
  { encabezado: 'Garantía baterías (meses)', valor: (m) => m.garantia_baterias_meses },
  { encabezado: 'Activo', valor: (m) => (m.activo ? 'Sí' : 'No') },
];
