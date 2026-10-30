import { describe, expect, it } from 'vitest';
import { aPorcentaje, esquemaAjustesVenta, esquemaMargenes, precioManual } from './precios';

describe('márgenes globales (SPEC §8, RN-09)', () => {
  it('porcentaje → fracción con 4 decimales', () => {
    expect(esquemaMargenes.parse({ unidad_x1: '45', mayorista_x3: '35,5', distribuidor_x6: '28.25' })).toEqual({
      unidad_x1: '0.4500',
      mayorista_x3: '0.3550',
      distribuidor_x6: '0.2825',
    });
  });

  it('el margen es menor que 100 % (precio = costo / (1 − margen))', () => {
    expect(esquemaMargenes.safeParse({ unidad_x1: '100', mayorista_x3: '35', distribuidor_x6: '28' }).success).toBe(false);
    expect(esquemaMargenes.safeParse({ unidad_x1: '-5', mayorista_x3: '35', distribuidor_x6: '28' }).success).toBe(false);
  });

  it('fracción → porcentaje para el formulario', () => {
    expect(aPorcentaje(0.45)).toBe('45');
    expect(aPorcentaje('0.3550')).toBe('35.5');
  });
});

describe('precio manual (SPEC §8)', () => {
  it('acepta montos con espacios o coma decimal y vacío = sugerido', () => {
    expect(precioManual.parse('5 790')).toBe('5790.00');
    expect(precioManual.parse('5790,5')).toBe('5790.50');
    expect(precioManual.parse('')).toBeNull();
  });

  it('rechaza 0, negativos y más de 2 decimales', () => {
    expect(precioManual.safeParse('0').success).toBe(false);
    expect(precioManual.safeParse('-1').success).toBe(false);
    expect(precioManual.safeParse('10.555').success).toBe(false);
  });
});

describe('ajustes de precio en ventas (RN-25, D43)', () => {
  it('RN-25: descuento máximo del vendedor, porcentaje → fracción de configuracion_ventas', () => {
    expect(esquemaAjustesVenta.parse({ porcentaje: '10', aumento: '30' })).toEqual({ porcentaje: '0.1000', aumento: '0.3000' });
    expect(esquemaAjustesVenta.parse({ porcentaje: '12,5', aumento: '30' }).porcentaje).toBe('0.1250');
    expect(esquemaAjustesVenta.parse({ porcentaje: '0', aumento: '30' }).porcentaje).toBe('0.0000');
    expect(esquemaAjustesVenta.safeParse({ porcentaje: '100', aumento: '30' }).success).toBe(false);
    expect(esquemaAjustesVenta.safeParse({ porcentaje: '', aumento: '30' }).success).toBe(false);
  });

  it('D43: aumento máximo sobre la lista entre 0.01 % y 100 %', () => {
    expect(esquemaAjustesVenta.parse({ porcentaje: '10', aumento: '15,5' }).aumento).toBe('0.1550');
    expect(esquemaAjustesVenta.parse({ porcentaje: '10', aumento: '100' }).aumento).toBe('1.0000');
    expect(esquemaAjustesVenta.safeParse({ porcentaje: '10', aumento: '0' }).success).toBe(false);
    expect(esquemaAjustesVenta.safeParse({ porcentaje: '10', aumento: '100.01' }).success).toBe(false);
    expect(esquemaAjustesVenta.safeParse({ porcentaje: '10', aumento: '' }).success).toBe(false);
  });
});
