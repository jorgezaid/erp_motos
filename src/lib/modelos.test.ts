import { describe, expect, it } from 'vitest';
import { bateriasDelModelo, ESTILO_CATEGORIA, textoCategoria, textoEnergia, textoPotencia } from './modelos';

describe('identidad del modelo (SPEC M2)', () => {
  it('M2: voltaje y baterías destacados («60V · 5 baterías»)', () => {
    expect(textoEnergia({ voltaje_sistema: 60, cantidad_baterias_12v: 5 })).toBe('60V · 5 baterías');
    expect(textoEnergia({ voltaje_sistema: 72, cantidad_baterias_12v: 6 })).toBe('72V · 6 baterías');
  });

  it('M2: si no viene la cantidad, se deriva del voltaje (48V = 4 baterías de 12V)', () => {
    expect(bateriasDelModelo({ voltaje_sistema: 48 })).toBe(4);
    expect(textoEnergia({ voltaje_sistema: 48, cantidad_baterias_12v: null })).toBe('48V · 4 baterías');
    expect(textoEnergia({ voltaje_sistema: null })).toBe('—');
  });

  it('potencia con separador de miles', () => {
    expect(textoPotencia(800)).toBe('800 W');
    expect(textoPotencia(1200)).toBe('1 200 W');
    expect(textoPotencia(null)).toBeNull();
  });

  it('cada categoría tiene texto y un color distinto', () => {
    expect(textoCategoria('bicimoto')).toBe('Bicimoto');
    expect(textoCategoria('trimoto_carga')).toBe('Trimoto de carga');
    expect(textoCategoria(null)).toBe('Sin categoría');
    expect(new Set(Object.values(ESTILO_CATEGORIA)).size).toBe(3);
  });
});
