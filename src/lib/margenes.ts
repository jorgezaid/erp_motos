/**
 * Reporte de margen real (SPEC M8) a partir de `v_sales_margin` (una fila por unidad vendida).
 * Agregados con decimal.js; margen = utilidad / precio (sobre el precio de venta, como SPEC §8).
 */
import { Decimal } from '@/lib/decimal';

export type FilaMargen = {
  order_id: string | null;
  numero: number | null;
  confirmada_at: string | null;
  tipo_venta: string | null;
  cliente_nombre: string | null;
  codigo_modelo: string | null;
  precio_unitario_pen: number | null;
  costo_landing_unitario_pen: number | null;
};

export type Agregado = { unidades: number; venta: string; costo: string; utilidad: string; margen: string | null };

function agregar(filas: readonly FilaMargen[]): Agregado {
  let venta = new Decimal(0);
  let costo = new Decimal(0);
  for (const f of filas) {
    venta = venta.plus(f.precio_unitario_pen ?? 0);
    costo = costo.plus(f.costo_landing_unitario_pen ?? 0);
  }
  const utilidad = venta.minus(costo);
  return {
    unidades: filas.length,
    venta: venta.toFixed(2),
    costo: costo.toFixed(2),
    utilidad: utilidad.toFixed(2),
    margen: venta.isZero() ? null : utilidad.div(venta).toFixed(4),
  };
}

function agrupar<K extends string>(filas: readonly FilaMargen[], clave: (f: FilaMargen) => K): Map<K, FilaMargen[]> {
  const m = new Map<K, FilaMargen[]>();
  for (const f of filas) {
    const k = clave(f);
    m.set(k, [...(m.get(k) ?? []), f]);
  }
  return m;
}

export type MargenVenta = Agregado & {
  order_id: string;
  numero: number;
  confirmada_at: string | null;
  cliente: string;
  tipo_venta: string | null;
};

/** Por venta: más reciente primero. */
export function margenPorVenta(filas: readonly FilaMargen[]): MargenVenta[] {
  return [...agrupar(filas, (f) => f.order_id ?? '')]
    .map(([order_id, fs]) => ({
      order_id,
      numero: fs[0]?.numero ?? 0,
      confirmada_at: fs[0]?.confirmada_at ?? null,
      cliente: fs[0]?.cliente_nombre ?? '',
      tipo_venta: fs[0]?.tipo_venta ?? null,
      ...agregar(fs),
    }))
    .sort((a, b) => b.numero - a.numero);
}

export type MargenModelo = Agregado & { codigo_modelo: string };

/** Por modelo: ordenado por código. */
export function margenPorModelo(filas: readonly FilaMargen[]): MargenModelo[] {
  return [...agrupar(filas, (f) => f.codigo_modelo ?? '')]
    .map(([codigo_modelo, fs]) => ({ codigo_modelo, ...agregar(fs) }))
    .sort((a, b) => a.codigo_modelo.localeCompare(b.codigo_modelo));
}

export function totalMargen(filas: readonly FilaMargen[]): Agregado {
  return agregar(filas);
}

/**
 * Rango de fechas de Lima (aaaa-mm-dd, inclusive) → límites en UTC para filtrar timestamps.
 * Perú no tiene horario de verano: siempre UTC−5.
 */
export function rangoLima(desde: string | null, hasta: string | null): { desde: string | null; hasta: string | null } {
  const valida = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const d = valida(desde);
  const h = valida(hasta);
  return {
    desde: d ? new Date(`${d}T00:00:00-05:00`).toISOString() : null,
    hasta: h ? new Date(new Date(`${h}T00:00:00-05:00`).getTime() + 86_400_000).toISOString() : null,
  };
}
