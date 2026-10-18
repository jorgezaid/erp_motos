import { describe, expect, it } from 'vitest';
import { aPorcentaje, esquemaDescuentoMaximo, esquemaMargenes, precioManual } from './precios';

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

describe('descuento máximo del vendedor (RN-25)', () => {
  it('RN-25: porcentaje → fracción de configuracion_ventas', () => {
    expect(esquemaDescuentoMaximo.parse({ porcentaje: '10' })).toEqual({ porcentaje: '0.1000' });
    expect(esquemaDescuentoMaximo.parse({ porcentaje: '12,5' })).toEqual({ porcentaje: '0.1250' });
    expect(esquemaDescuentoMaximo.parse({ porcentaje: '0' })).toEqual({ porcentaje: '0.0000' });
    expect(esquemaDescuentoMaximo.safeParse({ porcentaje: '100' }).success).toBe(false);
    expect(esquemaDescuentoMaximo.safeParse({ porcentaje: '' }).success).toBe(false);
  });
});
