/** Indicadores del dashboard (SPEC M8). Fechas de negocio en America/Lima; montos con decimal.js. */
import { Decimal } from '@/lib/decimal';
import { hoyLima } from '@/lib/format';

/** Primer día del mes de Lima (aaaa-mm-01). */
export function inicioMesLima(ahora: Date = new Date()): string {
  return `${hoyLima(ahora).slice(0, 7)}-01`;
}

export type ResumenVentas = { cantidad: number; total: string };

/** Ventas confirmadas desde `desdeUtc` (inclusive): cantidad y Σ total_pen. */
export function resumirVentas(
  ventas: readonly { confirmada_at: string | null; total_pen: number }[],
  desdeUtc: string,
): ResumenVentas {
  const desde = new Date(desdeUtc).getTime();
  const del = ventas.filter((v) => v.confirmada_at && new Date(v.confirmada_at).getTime() >= desde);
  return {
    cantidad: del.length,
    total: del.reduce((s, v) => s.plus(v.total_pen), new Decimal(0)).toFixed(2),
  };
}

export type UtilidadMes = { ventas: string; costo: string; gastos: string; neta: string; unidades: number; cantidadGastos: number };

type FilaUtilidad = {
  ventas_pen: number | null;
  costo_landing_pen: number | null;
  gastos_pen: number | null;
  unidades_vendidas: number | null;
  cantidad_gastos: number | null;
};

/**
 * RN-23: utilidad neta del mes = ventas − costo landing de lo vendido − gastos realizados.
 * Parte de la fila de `v_utilidad_mensual` (sin fila = mes sin ventas ni gastos) y recalcula la
 * neta con decimal.js para que el desglose cuadre siempre con lo que se muestra.
 */
export function utilidadDelMes(fila: FilaUtilidad | null | undefined): UtilidadMes {
  const ventas = new Decimal(fila?.ventas_pen ?? 0);
  const costo = new Decimal(fila?.costo_landing_pen ?? 0);
  const gastos = new Decimal(fila?.gastos_pen ?? 0);
  return {
    ventas: ventas.toFixed(2),
    costo: costo.toFixed(2),
    gastos: gastos.toFixed(2),
    neta: ventas.minus(costo).minus(gastos).toFixed(2),
    unidades: fila?.unidades_vendidas ?? 0,
    cantidadGastos: fila?.cantidad_gastos ?? 0,
  };
}

/** Ancho relativo (0–100) de cada barra respecto al máximo, para el desglose por estado. */
export function anchoRelativo(valor: number, maximo: number): number {
  if (maximo <= 0 || valor <= 0) return 0;
  return Math.max(2, Math.round((valor / maximo) * 100));
}
