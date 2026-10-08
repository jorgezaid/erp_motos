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

/** Ancho relativo (0–100) de cada barra respecto al máximo, para el desglose por estado. */
export function anchoRelativo(valor: number, maximo: number): number {
  if (maximo <= 0 || valor <= 0) return 0;
  return Math.max(2, Math.round((valor / maximo) * 100));
}
