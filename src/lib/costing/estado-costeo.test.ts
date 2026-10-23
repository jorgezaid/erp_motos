import { describe, expect, it } from 'vitest';
import { calcularCosteoCompraLocal } from './compra-local';
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

  it('D41: una importación guardada (compra y otros gastos en 0 en la BD) sigue vigente', () => {
    const guardadas = comoGuardadas(calculadas).map((g) => ({ ...g, compra_asignada_pen: 0, otros_gastos_asignado_pen: 0 }));
    expect(estadoCosteo(guardadas, calculadas)).toBe('vigente');
  });

  it('D41: compra local desactualizada si cambia el precio de compra o los otros gastos', () => {
    const compra = { precio_incluye_igv: true, igv_al_costo: true, flete_nacional_pen: '1000', otros_gastos_pen: '100', costo_armado_unitario_pen: '50' };
    const items = [{ model_id: 'a', codigo_modelo: 'LUNA-T', cantidad_packing_list: 4, precio_compra_unitario_pen: '5900' }];
    const guardadas = comoGuardadas(calcularCosteoCompraLocal(compra, items));
    expect(estadoCosteo(guardadas, calcularCosteoCompraLocal(compra, items))).toBe('vigente');
    const otroPrecio = [{ ...items[0], precio_compra_unitario_pen: '5800' }] as typeof items;
    expect(estadoCosteo(guardadas, calcularCosteoCompraLocal(compra, otroPrecio))).toBe('desactualizado');
    expect(estadoCosteo(guardadas, calcularCosteoCompraLocal({ ...compra, otros_gastos_pen: '0' }, items))).toBe('desactualizado');
  });
});
