import 'server-only';
import { COBERTURA, ESTADO_RECLAMO } from '@/lib/etiquetas';
import { formatFecha, formatFechaHora } from '@/lib/format';
import { textoVigencia } from '@/lib/garantias';
import { createClient } from '@/lib/supabase/server';
import { filtroBusqueda, MAX_FILAS_CSV, rango, valorPermitido, type ColumnaCsv, type ParamsTabla } from '@/lib/tabla';
import type { Database } from '@/types/database';

type Enums = Database['public']['Enums'];
export type FilaGarantia = Database['public']['Views']['v_warranties']['Row'];

export const ESTADOS_GARANTIA = [
  { valor: 'vigente', etiqueta: 'Vigentes' },
  { valor: 'vencida', etiqueta: 'Vencidas' },
  { valor: 'anulada', etiqueta: 'Anuladas' },
];

/** Búsqueda por VIN, DNI o RUC (SPEC M7) sobre v_warranties. */
export async function consultarGarantias({ q, estado, pagina }: ParamsTabla, { todas = false }: { todas?: boolean } = {}) {
  const supabase = await createClient();
  let consulta = supabase
    .from('v_warranties')
    .select('*', { count: 'exact' })
    .order('fecha_fin', { ascending: false })
    .order('vin_chasis');
  const or = filtroBusqueda(q, ['vin_chasis', 'cliente_documento', 'cliente_nombre']);
  if (or) consulta = consulta.or(or);
  if (estado === 'vigente') consulta = consulta.eq('vigente', true);
  if (estado === 'vencida') consulta = consulta.eq('vigente', false).eq('anulada', false);
  if (estado === 'anulada') consulta = consulta.eq('anulada', true);

  const [desde, hasta] = todas ? [0, MAX_FILAS_CSV - 1] : rango(pagina);
  const { data, count, error } = await consulta.range(desde, hasta);
  if (error) throw new Error(error.message);
  return { filas: data, total: count ?? 0 };
}

export type FilaReclamo = {
  id: string;
  creado: string;
  vin: string;
  modelo: string;
  cliente: string;
  documento: string;
  cobertura: Enums['warranty_coverage'];
  descripcion: string;
  diagnostico: string | null;
  estado: Enums['claim_status'];
  tecnico: string | null;
  costo: number | null;
};

export async function consultarReclamos(estado: string, { todas = false }: { todas?: boolean } = {}) {
  const supabase = await createClient();
  let consulta = supabase
    .from('warranty_claims')
    .select(
      'id, created_at, descripcion, diagnostico, estado, costo_reparacion_pen, profiles(nombre), warranties(cobertura, vehicle_inventory(vin_chasis, vehicle_models(codigo_modelo)), sales_orders(cliente_nombre, cliente_documento))',
    )
    .order('created_at', { ascending: false });
  const e = valorPermitido(estado, Object.keys(ESTADO_RECLAMO) as Enums['claim_status'][]);
  if (e) consulta = consulta.eq('estado', e);
  const { data, error } = await consulta.limit(todas ? MAX_FILAS_CSV : 100);
  if (error) throw new Error(error.message);

  return data.map(
    (r): FilaReclamo => ({
      id: r.id,
      creado: r.created_at,
      vin: r.warranties?.vehicle_inventory?.vin_chasis ?? '',
      modelo: r.warranties?.vehicle_inventory?.vehicle_models?.codigo_modelo ?? '',
      cliente: r.warranties?.sales_orders?.cliente_nombre ?? '',
      documento: r.warranties?.sales_orders?.cliente_documento ?? '',
      cobertura: r.warranties?.cobertura ?? 'general',
      descripcion: r.descripcion,
      diagnostico: r.diagnostico,
      estado: r.estado,
      tecnico: r.profiles?.nombre ?? null,
      costo: r.costo_reparacion_pen,
    }),
  );
}

export const COLUMNAS_CSV_GARANTIAS: ColumnaCsv<FilaGarantia>[] = [
  { encabezado: 'VIN', valor: (g) => g.vin_chasis },
  { encabezado: 'Modelo', valor: (g) => g.codigo_modelo },
  { encabezado: 'Cliente', valor: (g) => g.cliente_nombre },
  { encabezado: 'Documento', valor: (g) => g.cliente_documento },
  { encabezado: 'Venta', valor: (g) => g.orden_numero },
  { encabezado: 'Cobertura', valor: (g) => (g.cobertura ? COBERTURA[g.cobertura] : '') },
  { encabezado: 'Inicio', valor: (g) => formatFecha(g.fecha_inicio) },
  { encabezado: 'Fin', valor: (g) => formatFecha(g.fecha_fin) },
  { encabezado: 'Estado', valor: (g) => textoVigencia(g) },
];

export const COLUMNAS_CSV_RECLAMOS: ColumnaCsv<FilaReclamo>[] = [
  { encabezado: 'Fecha', valor: (r) => formatFechaHora(r.creado) },
  { encabezado: 'VIN', valor: (r) => r.vin },
  { encabezado: 'Cliente', valor: (r) => r.cliente },
  { encabezado: 'Cobertura', valor: (r) => COBERTURA[r.cobertura] },
  { encabezado: 'Descripción', valor: (r) => r.descripcion },
  { encabezado: 'Diagnóstico', valor: (r) => r.diagnostico },
  { encabezado: 'Estado', valor: (r) => ESTADO_RECLAMO[r.estado] },
  { encabezado: 'Técnico', valor: (r) => r.tecnico },
  { encabezado: 'Costo de reparación (S/)', valor: (r) => r.costo },
];
