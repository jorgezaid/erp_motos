import { describe, expect, it } from 'vitest';
import { margenPorModelo, margenPorVenta, rangoLima, totalMargen, type FilaMargen } from './margenes';

const fila = (o: Partial<FilaMargen>): FilaMargen => ({
  order_id: 'a',
  numero: 1,
  confirmada_at: '2026-10-07T15:00:00Z',
  tipo_venta: 'unidad_x1',
  cliente_nombre: 'Juana',
  codigo_modelo: 'DEMO-48',
  precio_unitario_pen: 5805.89,
  costo_landing_unitario_pen: 3193.24,
  ...o,
});

describe('margen real (SPEC M8)', () => {
  it('x1 de DEMO-48: margen ≈ 45 % (SPEC §8)', () => {
    expect(totalMargen([fila({})])).toEqual({
      unidades: 1,
      venta: '5805.89',
      costo: '3193.24',
      utilidad: '2612.65',
      margen: '0.4500',
    });
  });

  it('por venta agrupa las unidades de cada orden', () => {
    const filas = [
      fila({}),
      fila({ order_id: 'b', numero: 2, tipo_venta: 'distribuidor_x6', precio_unitario_pen: 4435.06 }),
      fila({ order_id: 'b', numero: 2, tipo_venta: 'distribuidor_x6', precio_unitario_pen: 4435.06 }),
    ];
    const ventas = margenPorVenta(filas);
    expect(ventas.map((v) => [v.numero, v.unidades, v.venta, v.margen])).toEqual([
      [2, 2, '8870.12', '0.2800'],
      [1, 1, '5805.89', '0.4500'],
    ]);
  });

  it('por modelo, con decimal.js (sin errores de coma flotante)', () => {
    const filas = [
      fila({ precio_unitario_pen: 0.1, costo_landing_unitario_pen: 0.05 }),
      fila({ precio_unitario_pen: 0.2, costo_landing_unitario_pen: 0.05 }),
      fila({ codigo_modelo: 'DEMO-72', precio_unitario_pen: 16287.8, costo_landing_unitario_pen: 8958.29 }),
    ];
    expect(margenPorModelo(filas)).toEqual([
      { codigo_modelo: 'DEMO-48', unidades: 2, venta: '0.30', costo: '0.10', utilidad: '0.20', margen: '0.6667' },
      { codigo_modelo: 'DEMO-72', unidades: 1, venta: '16287.80', costo: '8958.29', utilidad: '7329.51', margen: '0.4500' },
    ]);
  });

  it('sin ventas no hay margen', () => {
    expect(totalMargen([]).margen).toBeNull();
  });
});

describe('rangoLima', () => {
  it('días de Lima (UTC−5) a límites UTC, con el último día inclusive', () => {
    expect(rangoLima('2026-10-07', '2026-10-07')).toEqual({
      desde: '2026-10-07T05:00:00.000Z',
      hasta: '2026-10-08T05:00:00.000Z',
    });
    expect(rangoLima('', 'x')).toEqual({ desde: null, hasta: null });
  });
});
