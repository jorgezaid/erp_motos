import { describe, expect, it } from 'vitest';
import { difiereDeDam, totalesLinea, totalesPacking } from './packing';

const golden = [
  { cantidad_packing_list: 6, cantidad_dam: 6, exw_usd_unitario: 300, volumen_cbm_unitario: 0.5 },
  { cantidad_packing_list: 2, cantidad_dam: 2, exw_usd_unitario: '900', volumen_cbm_unitario: '2.0000' },
];

describe('totales del packing list (SPEC M3)', () => {
  it('replica exw_total_usd y cbm_total por línea', () => {
    expect(totalesLinea({ cantidad_packing_list: 2, cantidad_dam: 2, exw_usd_unitario: '900', volumen_cbm_unitario: '2.0000' })).toEqual({
      exw: '1800.00',
      cbm: '4.0000',
    });
  });

  it('golden test (SPEC §7): 8 unidades, EXW 3 600, CBM 7', () => {
    expect(totalesPacking(golden)).toEqual({ unidades: 8, unidadesDam: 8, exw: '3600.00', cbm: '7.0000' });
  });

  it('sin decimales flotantes: 3 × 0.1 CBM = 0.3000', () => {
    expect(totalesPacking([{ cantidad_packing_list: 3, cantidad_dam: null, exw_usd_unitario: 0.1, volumen_cbm_unitario: 0.1 }])).toEqual({
      unidades: 3,
      unidadesDam: null,
      exw: '0.30',
      cbm: '0.3000',
    });
  });

  it('alerta packing vs DAM solo si la DAM declara otra cantidad', () => {
    expect(difiereDeDam({ cantidad_packing_list: 6, cantidad_dam: 5 })).toBe(true);
    expect(difiereDeDam({ cantidad_packing_list: 6, cantidad_dam: null })).toBe(false);
    expect(difiereDeDam({ cantidad_packing_list: 6, cantidad_dam: 6 })).toBe(false);
  });

  it('vacío', () => {
    expect(totalesPacking([])).toEqual({ unidades: 0, unidadesDam: null, exw: '0.00', cbm: '0.0000' });
  });
});
