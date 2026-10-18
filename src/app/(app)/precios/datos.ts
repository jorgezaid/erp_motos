import 'server-only';
import { exigirRol } from '@/lib/auth';
import { ordenarEscalas } from '@/lib/escalas';
import { createClient } from '@/lib/supabase/server';
import { MAX_FILAS_CSV } from '@/lib/tabla';
import type { Database } from '@/types/database';

type TipoVenta = Database['public']['Enums']['sale_type'];
type Precio = { venta: number; sugerido: number; manual: number | null };

async function stockDisponible(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_stock')
    .select('batch_id, model_id')
    .eq('estado', 'listo_en_tienda')
    .limit(MAX_FILAS_CSV);
  if (error) throw new Error(error.message);
  const n = new Map<string, number>();
  for (const s of data) {
    const k = `${s.batch_id}:${s.model_id}`;
    n.set(k, (n.get(k) ?? 0) + 1);
  }
  return n;
}

// ---------------------------------------------------------------- vendedor (sin costos)

export type FilaPrecioVendedor = {
  clave: string;
  codigo_modelo: string;
  nombre: string;
  voltaje: number;
  disponibles: number;
  x1: number | null;
  x3: number | null;
  x6: number | null;
};

/**
 * Vista del vendedor (SPEC M5): modelo, stock disponible y precios x1/x3/x6. Solo lee
 * price_list y v_stock: ninguna tabla ni vista de costos (M5 ✅: no aparecen en la red).
 */
export async function preciosVendedor(q: string): Promise<FilaPrecioVendedor[]> {
  await exigirRol('admin', 'vendedor');
  const supabase = await createClient();
  const [{ data, error }, stock] = await Promise.all([
    supabase
      .from('price_list')
      .select('batch_id, model_id, tipo_venta, precio_venta_pen, vehicle_models(codigo_modelo, nombre_comercial, voltaje_sistema)')
      .limit(MAX_FILAS_CSV),
    stockDisponible(),
  ]);
  if (error) throw new Error(error.message);

  const filas = new Map<string, FilaPrecioVendedor>();
  for (const p of data) {
    const k = `${p.batch_id}:${p.model_id}`;
    const m = p.vehicle_models;
    const f = filas.get(k) ?? {
      clave: k,
      codigo_modelo: m?.codigo_modelo ?? '',
      nombre: m?.nombre_comercial ?? '',
      voltaje: m?.voltaje_sistema ?? 0,
      disponibles: stock.get(k) ?? 0,
      x1: null,
      x3: null,
      x6: null,
    };
    const escala = ({ unidad_x1: 'x1', mayorista_x3: 'x3', distribuidor_x6: 'x6' } as const)[p.tipo_venta];
    f[escala] = p.precio_venta_pen;
    filas.set(k, f);
  }
  const texto = q.toLowerCase();
  return [...filas.values()]
    .filter((f) => !texto || f.codigo_modelo.toLowerCase().includes(texto) || f.nombre.toLowerCase().includes(texto))
    .sort((a, b) => a.codigo_modelo.localeCompare(b.codigo_modelo) || b.disponibles - a.disponibles)
    // La clave no debe revelar el lote al vendedor
    .map((f, i) => ({ ...f, clave: String(i) }));
}

// ---------------------------------------------------------------- admin (con costos)

export type FilaPrecioAdmin = {
  batch_id: string;
  model_id: string;
  codigo_embarque: string;
  codigo_modelo: string;
  costo: number | null;
  disponibles: number;
  precios: Partial<Record<TipoVenta, Precio>>;
};

/** Vista del admin (SPEC M5): v_price_matrix + precio sugerido/manual de cada escala. */
export async function preciosAdmin(q: string): Promise<FilaPrecioAdmin[]> {
  await exigirRol('admin');
  const supabase = await createClient();
  const [{ data: matriz, error }, { data: lista, error: errorLista }, stock] = await Promise.all([
    supabase.from('v_price_matrix').select('*').order('codigo_modelo').limit(MAX_FILAS_CSV),
    supabase.from('price_list').select('batch_id, model_id, tipo_venta, precio_sugerido_pen, precio_manual_pen, precio_venta_pen').limit(MAX_FILAS_CSV),
    stockDisponible(),
  ]);
  if (error) throw new Error(error.message);
  if (errorLista) throw new Error(errorLista.message);

  const precios = new Map<string, Partial<Record<TipoVenta, Precio>>>();
  for (const p of lista) {
    const k = `${p.batch_id}:${p.model_id}`;
    precios.set(k, {
      ...precios.get(k),
      [p.tipo_venta]: { venta: p.precio_venta_pen ?? p.precio_sugerido_pen, sugerido: p.precio_sugerido_pen, manual: p.precio_manual_pen },
    });
  }
  const texto = q.toLowerCase();
  return matriz
    .filter((m) => precios.has(`${m.batch_id}:${m.model_id}`))
    .filter(
      (m) =>
        !texto ||
        (m.codigo_modelo ?? '').toLowerCase().includes(texto) ||
        (m.codigo_embarque ?? '').toLowerCase().includes(texto),
    )
    .map((m) => {
      const k = `${m.batch_id}:${m.model_id}`;
      return {
        batch_id: m.batch_id ?? '',
        model_id: m.model_id ?? '',
        codigo_embarque: m.codigo_embarque ?? '',
        codigo_modelo: m.codigo_modelo ?? '',
        costo: m.costo_landing_unitario_pen,
        disponibles: stock.get(k) ?? 0,
        precios: precios.get(k) ?? {},
      };
    });
}

export async function margenesActuales() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('price_margins').select('tipo_venta, cantidad_minima, margen_objetivo, activo');
  if (error) throw new Error(error.message);
  return ordenarEscalas(data);
}

/** RN-25: descuento máximo por moto del vendedor (fracción). */
export async function descuentoMaximoVendedor() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('configuracion_ventas').select('descuento_max_vendedor').maybeSingle();
  if (error) throw new Error(error.message);
  return data?.descuento_max_vendedor ?? 0;
}
