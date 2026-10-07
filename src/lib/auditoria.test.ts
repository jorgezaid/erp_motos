import { describe, expect, it } from 'vitest';
import { alertasConciliacion, tieneAlertas, type FilaConciliacion } from './auditoria';

const base: FilaConciliacion = {
  codigo_modelo: 'DEMO-60',
  cantidad_packing_list: 5,
  cantidad_dam: 5,
  unidades_registradas: 5,
  unidades_baterias_completas: 5,
  unidades_inspeccion_aprobada: 5,
  alerta_packing_vs_dam: false,
  alerta_faltan_registrar: false,
  alerta_baterias: false,
};

describe('alertas de conciliación (v_batch_reconciliation)', () => {
  it('sin alertas', () => {
    expect(alertasConciliacion(base)).toEqual([]);
    expect(tieneAlertas(base)).toBe(false);
  });

  it('packing vs DAM, faltantes y baterías incompletas', () => {
    const f = {
      ...base,
      cantidad_dam: 4,
      unidades_registradas: 3,
      unidades_baterias_completas: 1,
      alerta_packing_vs_dam: true,
      alerta_faltan_registrar: true,
      alerta_baterias: true,
    };
    expect(alertasConciliacion(f)).toEqual([
      'La DAM declara 4 y el packing list 5',
      'Faltan registrar 2 de 5',
      '2 unidad(es) con baterías incompletas',
    ]);
    expect(tieneAlertas(f)).toBe(true);
  });
});
