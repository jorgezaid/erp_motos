import { describe, expect, it } from 'vitest';
import { estadoCosteo, type FilaGuardada } from './estado-costeo';
import { calcularProrrateo, type FilaCosteo } from './prorrateo';

const lote = {
  tipo_cambio: '3.78',
  fob_total_usd: '7200',
  flete_internacional_usd: '800',
  gastos_agente_usd: '200',
  impuestos_asignables_pen: '2000',
  flete_nacional_pen: '400',
  alquiler_periodo_pen: '1000',
  sueldos_periodo_pen: '2000',
  publicidad_inicial_pen: '200',
  costo_armado_unitario_pen: '60',
};
const lineas = [
  { model_id: 'a', codigo_modelo: 'TEST-48', cantidad_packing_list: 6, exw_total_usd: '1800', cbm_total: '3' },
  { model_id: 'b', codigo_modelo: 'TEST-72', cantidad_packing_list: 2, exw_total_usd: '1800', cbm_total: '4' },
];
const calculadas = calcularProrrateo(lote, lineas);

/** Como llegan de PostgREST: numeric → number */
const comoGuardadas = (filas: FilaCosteo[]): FilaGuardada[] =>
  filas.map((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, k === 'model_id' ? v : Number(v)])) as FilaGuardada);

describe('estadoCosteo (RN-07: liquidar exige costeo vigente)', () => {
  it('sin filas guardadas', () => {
    expect(estadoCosteo([], calculadas)).toBe('sin_costeo');
  });

  it('vigente si coincide al céntimo de 4 decimales (aunque llegue como number)', () => {
    expect(estadoCosteo(comoGuardadas(calculadas), calculadas)).toBe('vigente');
  });

  it('desactualizado si cambió un monto, la cantidad o los modelos', () => {
    const otro = calcularProrrateo({ ...lote, fob_total_usd: '7300' }, lineas);
    expect(estadoCosteo(comoGuardadas(calculadas), otro)).toBe('desactualizado');
    expect(estadoCosteo(comoGuardadas(calculadas), calculadas.slice(0, 1))).toBe('desactualizado');
    expect(estadoCosteo(comoGuardadas(calculadas), null)).toBe('desactualizado');
  });
});
