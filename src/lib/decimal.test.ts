import DecimalBase from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { Decimal } from '@/lib/decimal';

describe('Decimal del proyecto', () => {
  it('SPEC §7: redondea half-up a 4 decimales, también en negativos', () => {
    expect(new Decimal('0.00005').toDecimalPlaces(4).toString()).toBe('0.0001');
    expect(new Decimal('-0.00005').toDecimalPlaces(4).toString()).toBe('-0.0001');
    expect(new Decimal('342.857142857').toDecimalPlaces(4).toFixed(4)).toBe('342.8571');
  });

  it('suma montos sin errores de coma flotante', () => {
    expect(new Decimal('0.1').plus('0.2').equals('0.3')).toBe(true);
  });

  it('no altera la configuración global de decimal.js', () => {
    expect(Decimal).not.toBe(DecimalBase);
    expect(Decimal.precision).toBe(40);
    expect(DecimalBase.precision).toBe(20); // valor por defecto de decimal.js
    expect(Decimal.rounding).toBe(DecimalBase.ROUND_HALF_UP);
  });
});
