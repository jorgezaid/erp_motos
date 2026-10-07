/** Totales del packing list (SPEC M3) con decimal.js: Σ unidades, Σ EXW y Σ CBM. */
import { Decimal } from '@/lib/decimal';
import type { Valor } from './prorrateo';

export type LineaPacking = {
  cantidad_packing_list: number;
  cantidad_dam: number | null;
  exw_usd_unitario: Valor;
  volumen_cbm_unitario: Valor;
};

/** EXW y CBM de una línea (replican las columnas generadas exw_total_usd y cbm_total). */
export function totalesLinea(l: LineaPacking): { exw: string; cbm: string } {
  return {
    exw: new Decimal(l.exw_usd_unitario).times(l.cantidad_packing_list).toFixed(2),
    cbm: new Decimal(l.volumen_cbm_unitario).times(l.cantidad_packing_list).toFixed(4),
  };
}

export function totalesPacking(lineas: readonly LineaPacking[]) {
  let exw = new Decimal(0);
  let cbm = new Decimal(0);
  let unidades = 0;
  let unidadesDam = 0;
  let damCompleta = lineas.length > 0;
  for (const l of lineas) {
    const t = totalesLinea(l);
    exw = exw.plus(t.exw);
    cbm = cbm.plus(t.cbm);
    unidades += l.cantidad_packing_list;
    if (l.cantidad_dam === null) damCompleta = false;
    else unidadesDam += l.cantidad_dam;
  }
  return {
    unidades,
    /** null si alguna línea no tiene cantidad de DAM */
    unidadesDam: damCompleta ? unidadesDam : null,
    exw: exw.toFixed(2),
    cbm: cbm.toFixed(4),
  };
}

/** La DAM declara una cantidad distinta (alerta de v_batch_reconciliation). */
export function difiereDeDam(l: Pick<LineaPacking, 'cantidad_packing_list' | 'cantidad_dam'>): boolean {
  return l.cantidad_dam !== null && l.cantidad_dam !== l.cantidad_packing_list;
}
