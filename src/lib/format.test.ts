import { describe, expect, it } from 'vitest';
import { formatFecha, formatFechaHora, formatNumero, formatPEN, formatPorcentaje, formatUSD, hoyLima } from './format';

describe('formatPEN / formatUSD (SPEC §10)', () => {
  it('soles: S/ 1 234.56 con miles separados por espacio', () => {
    expect(formatPEN('1234.56')).toBe('S/ 1 234.56');
    expect(formatPEN(37076)).toBe('S/ 37 076.00');
    expect(formatPEN('1234567.891')).toBe('S/ 1 234 567.89');
    expect(formatPEN(0)).toBe('S/ 0.00');
    expect(formatPEN('-50.5')).toBe('S/ -50.50');
  });

  it('dólares: US$ 1,234.56 con miles separados por coma', () => {
    expect(formatUSD('7200')).toBe('US$ 7,200.00');
    expect(formatUSD(1234567.5)).toBe('US$ 1,234,567.50');
  });

  it('redondea half-up (como la BD)', () => {
    expect(formatPEN('0.005')).toBe('S/ 0.01');
    expect(formatPEN('2.675')).toBe('S/ 2.68');
  });

  it('vacío o inválido → —', () => {
    expect(formatPEN(null)).toBe('—');
    expect(formatUSD(undefined)).toBe('—');
    expect(formatPEN('abc')).toBe('—');
  });

  it('formatNumero con otros decimales (CBM)', () => {
    expect(formatNumero('1234.5', 4)).toBe('1 234.5000');
  });
});

describe('formatPorcentaje', () => {
  it('fracción → porcentaje', () => {
    expect(formatPorcentaje('0.45')).toBe('45 %');
    expect(formatPorcentaje('0.4512')).toBe('45.12 %');
    expect(formatPorcentaje(0.28)).toBe('28 %');
    expect(formatPorcentaje(null)).toBe('—');
  });
});

describe('fechas en America/Lima', () => {
  it('las columnas date no se corren de día', () => {
    expect(formatFecha('2026-10-07')).toBe('07/10/2026');
  });

  it('los timestamps se muestran en hora de Lima (UTC−5)', () => {
    // 02:30 UTC del 8 de octubre = 21:30 del 7 en Lima
    expect(formatFecha('2026-10-08T02:30:00Z')).toBe('07/10/2026');
    expect(formatFechaHora('2026-10-08T02:30:00Z')).toBe('07/10/2026 21:30');
  });

  it('hoyLima equivale a public.fecha_lima()', () => {
    expect(hoyLima(new Date('2026-10-08T02:30:00Z'))).toBe('2026-10-07');
    expect(hoyLima(new Date('2026-10-08T05:00:00Z'))).toBe('2026-10-08');
  });

  it('vacío → —', () => {
    expect(formatFecha(null)).toBe('—');
    expect(formatFechaHora('')).toBe('—');
  });
});
