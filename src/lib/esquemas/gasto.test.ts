import { describe, expect, it } from 'vitest';
import { esquemaGasto, esquemaRealizado, gastoVacio, type EntradaGasto } from './gasto';

const base: EntradaGasto = {
  ...gastoVacio('2026-10-15'),
  categoria: 'servicios',
  descripcion: '  Luz de octubre ',
  proveedor: '',
  monto_pen: '350,5',
  metodo_pago: 'transferencia',
};

function errores(entrada: EntradaGasto) {
  const r = esquemaGasto.safeParse(entrada);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]));
}

describe('esquemaGasto', () => {
  it('normaliza un gasto realizado válido', () => {
    expect(esquemaGasto.parse(base)).toEqual({
      estado: 'realizado',
      fecha: '2026-10-15',
      fecha_estimada: null,
      categoria: 'servicios',
      descripcion: 'Luz de octubre',
      proveedor: null,
      monto_pen: '350.5',
      metodo_pago: 'transferencia',
    });
  });

  it('RN-21: un realizado exige fecha de pago y método de pago', () => {
    expect(errores({ ...base, fecha: '', metodo_pago: '' })).toEqual({
      fecha: 'Fecha de pago: es obligatoria en un gasto realizado.',
      metodo_pago: 'Método de pago: es obligatorio en un gasto realizado.',
    });
  });

  it('RN-21: un planificado exige fecha estimada y se guarda sin fecha de pago', () => {
    expect(errores({ ...base, estado: 'planificado', fecha_estimada: '' })).toHaveProperty('fecha_estimada');
    const g = esquemaGasto.parse({ ...base, estado: 'planificado', fecha_estimada: '2026-11-30', metodo_pago: '' });
    expect(g).toMatchObject({ estado: 'planificado', fecha: null, fecha_estimada: '2026-11-30', metodo_pago: null });
  });

  it('RN-21: el monto es mayor que 0, con hasta 2 decimales y cabe en numeric(14,2)', () => {
    expect(errores({ ...base, monto_pen: '0' })).toHaveProperty('monto_pen');
    expect(errores({ ...base, monto_pen: '-5' })).toHaveProperty('monto_pen');
    expect(errores({ ...base, monto_pen: '10.555' })).toHaveProperty('monto_pen');
    expect(errores({ ...base, monto_pen: '1000000000000' })).toHaveProperty('monto_pen');
    expect(errores({ ...base, monto_pen: '999999999999.99' })).toEqual({});
  });

  it('exige descripción y no acepta "mixto" como método', () => {
    expect(errores({ ...base, descripcion: '   ' })).toHaveProperty('descripcion');
    expect(errores({ ...base, metodo_pago: 'mixto' as EntradaGasto['metodo_pago'] })).toHaveProperty('metodo_pago');
  });
});

describe('esquemaRealizado', () => {
  it('RN-21: marcar como realizado pide monto real, fecha y método', () => {
    expect(esquemaRealizado.parse({ monto_pen: '1200', fecha: '2026-10-15', metodo_pago: 'efectivo' })).toEqual({
      monto_pen: '1200',
      fecha: '2026-10-15',
      metodo_pago: 'efectivo',
    });
    const r = esquemaRealizado.safeParse({ monto_pen: '', fecha: '', metodo_pago: '' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(['monto_pen', 'fecha', 'metodo_pago']));
  });
});
