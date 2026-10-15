import { describe, expect, it } from 'vitest';
import { esquemaEscalaActiva, minimosPorTipo, mostrarSelectorEscala, ordenarEscalas, tiposActivos, type Escala } from './escalas';

const escalas: Escala[] = [
  { tipo_venta: 'distribuidor_x6', cantidad_minima: 6, activo: false },
  { tipo_venta: 'unidad_x1', cantidad_minima: 1, activo: true },
  { tipo_venta: 'mayorista_x3', cantidad_minima: 3, activo: false },
];

describe('D31: escalas de venta activas', () => {
  it('ordena x1, x3, x6 y devuelve solo las activas', () => {
    expect(ordenarEscalas(escalas).map((e) => e.tipo_venta)).toEqual(['unidad_x1', 'mayorista_x3', 'distribuidor_x6']);
    expect(tiposActivos(escalas)).toEqual(['unidad_x1']);
    expect(tiposActivos(escalas.map((e) => ({ ...e, activo: true })))).toEqual(['unidad_x1', 'mayorista_x3', 'distribuidor_x6']);
  });

  it('mínimos por tipo (1 si falta la escala)', () => {
    expect(minimosPorTipo(escalas)).toEqual({ unidad_x1: 1, mayorista_x3: 3, distribuidor_x6: 6 });
    expect(minimosPorTipo([])).toEqual({ unidad_x1: 1, mayorista_x3: 1, distribuidor_x6: 1 });
  });

  it('con una sola escala activa no hay selector, salvo que la orden tenga una escala desactivada', () => {
    expect(mostrarSelectorEscala(['unidad_x1'])).toBe(false);
    expect(mostrarSelectorEscala(['unidad_x1'], 'unidad_x1')).toBe(false);
    expect(mostrarSelectorEscala(['unidad_x1'], 'mayorista_x3')).toBe(true);
    expect(mostrarSelectorEscala(['unidad_x1', 'distribuidor_x6'], 'unidad_x1')).toBe(true);
  });

  it('esquema del interruptor', () => {
    expect(esquemaEscalaActiva.safeParse({ tipoVenta: 'mayorista_x3', activo: true }).success).toBe(true);
    expect(esquemaEscalaActiva.safeParse({ tipoVenta: 'mixto', activo: true }).success).toBe(false);
    expect(esquemaEscalaActiva.safeParse({ tipoVenta: 'unidad_x1', activo: 'si' }).success).toBe(false);
  });
});
