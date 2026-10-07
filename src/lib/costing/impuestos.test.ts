import { describe, expect, it } from 'vitest';
import { impuestosAsignables, impuestosSunat } from './impuestos';

const golden = { ad_valorem_pen: '500', igv_pen: '1000', ipm_pen: '200', percepcion_pen: '300' };

describe('impuestos del lote (RN-05)', () => {
  it('impuestos SUNAT = Ad Valorem + IGV + IPM + percepción', () => {
    expect(impuestosSunat({ ...golden, impuestos_recuperables_al_costo: true })).toBe('2000.00');
  });

  it('RN-05: con el interruptor activo se cargan todos al costo (golden test: 2 000)', () => {
    expect(impuestosAsignables({ ...golden, impuestos_recuperables_al_costo: true })).toBe('2000.00');
  });

  it('RN-05: con el interruptor apagado solo el Ad Valorem va al costo', () => {
    expect(impuestosAsignables({ ...golden, impuestos_recuperables_al_costo: false })).toBe('500.00');
  });

  it('campos vacíos o inválidos cuentan como 0 en la vista previa', () => {
    expect(impuestosSunat({ ad_valorem_pen: '', igv_pen: 'x', ipm_pen: '0.10', percepcion_pen: '0.20', impuestos_recuperables_al_costo: true })).toBe(
      '0.30',
    );
  });
});
