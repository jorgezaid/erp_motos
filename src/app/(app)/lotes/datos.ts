import 'server-only';
import { proveedoresQueCoinciden } from '@/lib/consultas/proveedores';
import { ESTADO_LOTE } from '@/lib/etiquetas';
import { formatFecha } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { filtroBusqueda, MAX_FILAS_CSV, rango, valorPermitido, type ColumnaCsv, type ParamsTabla } from '@/lib/tabla';
import type { Database } from '@/types/database';

type EstadoLote = Database['public']['Enums']['batch_status'];

export type FilaLote = Pick<
  Database['public']['Tables']['import_batches']['Row'],
  'id' | 'codigo_embarque' | 'nro_dam' | 'fecha_llegada' | 'estado' | 'tipo_cambio' | 'created_at'
> & { proveedor: string | null; unidades: number };

/** `proveedor`: id del proveedor (D41). La búsqueda también encuentra lotes por nombre o RUC del proveedor. */
export async function consultarLotes(
  { q, estado, pagina, proveedor }: ParamsTabla & { proveedor?: string },
  { todas = false }: { todas?: boolean } = {},
) {
  const supabase = await createClient();
  let consulta = supabase
    .from('import_batches')
    .select('id, codigo_embarque, nro_dam, fecha_llegada, estado, tipo_cambio, created_at, proveedores(nombre), batch_items(cantidad_packing_list)', {
      count: 'exact',
    })
    .order('created_at', { ascending: false });

  const or = filtroBusqueda(q, ['codigo_embarque', 'nro_dam']);
  if (or) {
    const ids = await proveedoresQueCoinciden(q);
    consulta = consulta.or(ids.length ? `${or},proveedor_id.in.(${ids.join(',')})` : or);
  }
  const e = valorPermitido(estado, Object.keys(ESTADO_LOTE) as EstadoLote[]);
  if (e) consulta = consulta.eq('estado', e);
  if (proveedor && /^[0-9a-f-]{36}$/i.test(proveedor)) consulta = consulta.eq('proveedor_id', proveedor);

  const [desde, hasta] = todas ? [0, MAX_FILAS_CSV - 1] : rango(pagina);
  const { data, count, error } = await consulta.range(desde, hasta);
  if (error) throw new Error(error.message);

  const filas: FilaLote[] = data.map(({ batch_items, proveedores, ...l }) => ({
    ...l,
    proveedor: proveedores?.nombre ?? null,
    unidades: batch_items.reduce((s, i) => s + i.cantidad_packing_list, 0),
  }));
  return { filas, total: count ?? 0 };
}

export const COLUMNAS_CSV: ColumnaCsv<FilaLote>[] = [
  { encabezado: 'Código de embarque', valor: (l) => l.codigo_embarque },
  { encabezado: 'DAM', valor: (l) => l.nro_dam },
  { encabezado: 'Proveedor', valor: (l) => l.proveedor },
  { encabezado: 'Llegada', valor: (l) => formatFecha(l.fecha_llegada) },
  { encabezado: 'Estado', valor: (l) => ESTADO_LOTE[l.estado] },
  { encabezado: 'Unidades (packing list)', valor: (l) => l.unidades },
  { encabezado: 'Tipo de cambio', valor: (l) => l.tipo_cambio },
];
