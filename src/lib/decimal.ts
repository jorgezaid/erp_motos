import DecimalBase from 'decimal.js';

/**
 * Decimal del proyecto para todo cálculo de dinero (CLAUDE.md regla 4, SPEC §7).
 * Es un clon aislado: no modifica la configuración global de decimal.js.
 * - precision 40: dígitos significativos de sobra para prorratear montos en PEN/USD.
 * - ROUND_HALF_UP: el redondeo "half-up" que exige el prorrateo (se aleja del cero en el .5).
 */
export const Decimal = DecimalBase.clone({
  precision: 40,
  rounding: DecimalBase.ROUND_HALF_UP,
});

export type Decimal = DecimalBase;
