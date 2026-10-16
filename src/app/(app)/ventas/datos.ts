import 'server-only';
import { ESTADO_ORDEN, METODO_PAGO, TIPO_VENTA } from '@/lib/etiquetas';
import { formatFechaHora } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { filtroBusqueda, MAX_FILAS_CSV, rango, valorPermitido, type ColumnaCsv, type ParamsTabla } from '@/lib/tabla';
import { puedeEditarOrden } from '@/lib/ventas';
import type { Database } from '@/types/database';

type Enums = Database['public']['Enums'];

export type FilaVenta = {
  id: string;
  numero: number;
  fecha: string;
  cliente_nombre: string;
  documento: string;
  tipo_venta: Enums['sale_type'];
  total_pen: number;
  metodo_pago: Enums['payment_method'] | null;
  estado: Enums['order_status'];
  vendedor: string;
  /** Solo en borradores: antigüedad («hace 3 días») y motos reservadas, para detectar olvidados. */
  creada: string;
  motos: number;
  puedeContinuar: boolean;
};

/**
 * Órdenes con los filtros de la URL. `mios=1` deja solo las del usuario («Mis borradores» junto
 * con `estado=borrador`).
 */
export async function consultarVentas(
  { q, estado, pagina, tipo, mios }: ParamsTabla & { tipo?: string; mios?: string },
  sesion: { userId: string; esAdmin: boolean },
  { todas = false }: { todas?: boolean } = {},
) {
  const supabase = await createClient();
  let consulta = supabase
    .from('sales_orders')
    .select(
      'id, numero, created_at, confirmada_at, cliente_nombre, cliente_tipo_documento, cliente_documento, tipo_venta, total_pen, metodo_pago, estado, vendedor_id, profiles(nombre), order_items(count)',
      { count: 'exact' },
    )
    .eq('order_items.activo', true)
    .order('numero', { ascending: false });
  if (mios === '1') consulta = consulta.eq('vendedor_id', sesion.userId);

  const busqueda = filtroBusqueda(q, ['cliente_nombre', 'cliente_documento']);
  if (busqueda) {
    const numero = /^#?\d{1,12}$/.test(q.trim()) ? Number(q.trim().replace('#', '')) : null;
    consulta = consulta.or(numero === null ? busqueda : `${busqueda},numero.eq.${numero}`);
  }
  const e = valorPermitido(estado, Object.keys(ESTADO_ORDEN) as Enums['order_status'][]);
  if (e) consulta = consulta.eq('estado', e);
  const t = valorPermitido(tipo ?? '', Object.keys(TIPO_VENTA) as Enums['sale_type'][]);
  if (t) consulta = consulta.eq('tipo_venta', t);

  const [desde, hasta] = todas ? [0, MAX_FILAS_CSV - 1] : rango(pagina);
  const { data, count, error } = await consulta.range(desde, hasta);
  if (error) throw new Error(error.message);

  const filas: FilaVenta[] = data.map((o) => ({
    id: o.id,
    numero: o.numero,
    fecha: o.confirmada_at ?? o.created_at,
    cliente_nombre: o.cliente_nombre,
    documento: `${o.cliente_tipo_documento} ${o.cliente_documento}`,
    tipo_venta: o.tipo_venta,
    total_pen: o.total_pen,
    metodo_pago: o.metodo_pago,
    estado: o.estado,
    vendedor: o.profiles?.nombre ?? '—',
    creada: o.created_at,
    motos: o.order_items[0]?.count ?? 0,
    puedeContinuar: o.estado === 'borrador' && puedeEditarOrden(o, sesion),
  }));
  return { filas, total: count ?? 0 };
}

export const COLUMNAS_CSV: ColumnaCsv<FilaVenta>[] = [
  { encabezado: 'N.º', valor: (v) => v.numero },
  { encabezado: 'Fecha', valor: (v) => formatFechaHora(v.fecha) },
  { encabezado: 'Cliente', valor: (v) => v.cliente_nombre },
  { encabezado: 'Documento', valor: (v) => v.documento },
  { encabezado: 'Tipo de venta', valor: (v) => TIPO_VENTA[v.tipo_venta] },
  { encabezado: 'Total (S/)', valor: (v) => v.total_pen.toFixed(2) },
  { encabezado: 'Pago', valor: (v) => (v.metodo_pago ? METODO_PAGO[v.metodo_pago] : '') },
  { encabezado: 'Estado', valor: (v) => ESTADO_ORDEN[v.estado] },
  { encabezado: 'Vendedor', valor: (v) => v.vendedor },
];
