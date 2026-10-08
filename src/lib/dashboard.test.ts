import { describe, expect, it } from 'vitest';
import { anchoRelativo, inicioMesLima, resumirVentas } from './dashboard';

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
