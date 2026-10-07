import { describe, expect, it } from 'vitest';
import { inspeccionAprobada, motivosObservada, requisitosTienda } from './taller';

describe('RN-11: inspección aprobada', () => {
  const ok = { baterias_contadas: 6, baterias_esperadas: 6, vin_verificado: true, motor_verificado: true };

  it('se aprueba con las baterías esperadas y VIN y motor verificados', () => {
    expect(inspeccionAprobada(ok)).toBe(true);
    expect(motivosObservada(ok)).toEqual([]);
  });

  it('M4: una unidad de 72V inspeccionada con 5 baterías queda observada', () => {
    const i = { ...ok, baterias_contadas: 5 };
    expect(inspeccionAprobada(i)).toBe(false);
    expect(motivosObservada(i)).toEqual(['Se contaron 5 baterías; el modelo lleva 6']);
  });

  it('sin VIN o motor verificados queda observada', () => {
    expect(motivosObservada({ ...ok, vin_verificado: false, motor_verificado: false })).toEqual([
      'VIN sin verificar',
      'Motor sin verificar',
    ]);
  });
});

describe('RN-10: requisitos para pasar a tienda', () => {
  const lista = { estado: 'en_ensamble', baterias: 6, esperadas: 6, ultimaInspeccionAprobada: true, ubicacion: 'x' };

  it('con todo cumplido no falta nada', () => {
    expect(requisitosTienda(lista)).toEqual([]);
  });

  it('(a) seriales incompletos, (b) última inspección observada o ausente, (c) sin ubicación', () => {
    expect(requisitosTienda({ ...lista, baterias: 5 })).toEqual(['Registra los seriales de batería (5 de 6)']);
    expect(requisitosTienda({ ...lista, ultimaInspeccionAprobada: false })).toEqual([
      'La última inspección está observada: registra una nueva',
    ]);
    expect(requisitosTienda({ ...lista, ultimaInspeccionAprobada: null })).toEqual(['Registra la inspección técnica']);
    expect(requisitosTienda({ ...lista, ubicacion: null })).toEqual(['Elige la ubicación en tienda']);
  });

  it('solo desde en ensamble', () => {
    expect(requisitosTienda({ ...lista, estado: 'en_caja' })).toEqual(['La unidad debe estar en ensamble']);
  });
});
