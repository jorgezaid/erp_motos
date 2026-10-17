import { describe, expect, it } from 'vitest';
import {
  agruparPorModelo,
  bateriasDelModelo,
  contarPorModelo,
  ESTILO_CATEGORIA,
  textoCategoria,
  textoConteoTaller,
  textoEnergia,
  textoPotencia,
} from './modelos';

describe('cola del taller agrupada por modelo (SPEC M4)', () => {
  const filas = [
    { codigo_modelo: 'XSDU-29', estado: 'en_caja', vin: 'A' },
    { codigo_modelo: 'XSDU-29', estado: 'en_ensamble', vin: 'B' },
    { codigo_modelo: 'XSDU-29', estado: 'en_caja', vin: 'C' },
    { codigo_modelo: 'XSDU-9', estado: 'en_caja', vin: 'D' },
    { codigo_modelo: 'XSDU-31', estado: 'listo_en_tienda', vin: 'E' },
  ];

  it('agrupa por código de modelo en orden natural (XSDU-9 antes que XSDU-29)', () => {
    const grupos = agruparPorModelo(filas);
    expect(grupos.map((g) => g.codigo)).toEqual(['XSDU-9', 'XSDU-29', 'XSDU-31']);
    expect(grupos[1]?.filas.map((f) => f.vin)).toEqual(['A', 'B', 'C']);
  });

  it('cuenta en caja y en ensamble por modelo (ignora otros estados)', () => {
    const c = contarPorModelo(filas);
    expect(c.get('XSDU-29')).toEqual({ en_caja: 2, en_ensamble: 1 });
    expect(c.has('XSDU-31')).toBe(false);
  });

  it('encabezado «9 en caja · 3 en ensamble»', () => {
    expect(textoConteoTaller({ en_caja: 9, en_ensamble: 3 })).toBe('9 en caja · 3 en ensamble');
    expect(textoConteoTaller({ en_caja: 0, en_ensamble: 2 })).toBe('2 en ensamble');
    expect(textoConteoTaller(undefined)).toBe('sin unidades en el taller');
  });
});

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
