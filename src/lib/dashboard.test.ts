import { describe, expect, it } from 'vitest';
import { anchoRelativo, inicioMesLima, resumirVentas, utilidadDelMes } from './dashboard';

describe('utilidadDelMes (RN-23)', () => {
  it('RN-23: utilidad neta = ventas − costo landing − gastos realizados', () => {
    expect(
      utilidadDelMes({ ventas_pen: 10000.1, costo_landing_pen: 6000.2, gastos_pen: 1500.3, unidades_vendidas: 3, cantidad_gastos: 2 }),
    ).toEqual({ ventas: '10000.10', costo: '6000.20', gastos: '1500.30', neta: '2499.60', unidades: 3, cantidadGastos: 2 });
  });
  it('RN-23: con gastos y sin ventas la utilidad es negativa', () => {
    expect(utilidadDelMes({ ventas_pen: 0, costo_landing_pen: 0, gastos_pen: 800, unidades_vendidas: 0, cantidad_gastos: 1 }).neta).toBe('-800.00');
  });
  it('un mes sin fila en la vista es todo cero', () => {
    expect(utilidadDelMes(null)).toEqual({ ventas: '0.00', costo: '0.00', gastos: '0.00', neta: '0.00', unidades: 0, cantidadGastos: 0 });
  });
});

describe('dashboard (SPEC M8)', () => {
  it('el mes es el de Lima (UTC−5)', () => {
    // 1 de noviembre 03:00 UTC = 31 de octubre 22:00 en Lima
    expect(inicioMesLima(new Date('2026-11-01T03:00:00Z'))).toBe('2026-10-01');
    expect(inicioMesLima(new Date('2026-11-01T06:00:00Z'))).toBe('2026-11-01');
  });

  it('ventas del periodo: cantidad y total con decimal.js', () => {
    const ventas = [
      { confirmada_at: '2026-10-07T15:00:00Z', total_pen: 0.1 },
      { confirmada_at: '2026-10-07T16:00:00Z', total_pen: 0.2 },
      { confirmada_at: '2026-10-06T16:00:00Z', total_pen: 100 },
      { confirmada_at: null, total_pen: 50 },
    ];
    expect(resumirVentas(ventas, '2026-10-07T05:00:00.000Z')).toEqual({ cantidad: 2, total: '0.30' });
  });

  it('barras proporcionales al máximo, con un mínimo visible', () => {
    expect(anchoRelativo(30, 30)).toBe(100);
    expect(anchoRelativo(15, 30)).toBe(50);
    expect(anchoRelativo(0, 30)).toBe(0);
    expect(anchoRelativo(1, 1000)).toBe(2);
  });
});
