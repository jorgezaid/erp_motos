import { describe, expect, it } from 'vitest';
import {
  agruparPorModelo,
  bateriasDelModelo,
  contarPorModelo,
  estiloColorModelo,
  indiceColorModelo,
  PALETA_MODELOS,
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

  it('D41: batería de litio con su cantidad («60V · 1 batería de litio»)', () => {
    expect(textoEnergia({ voltaje_sistema: 60, cantidad_baterias_12v: 1, tipo_bateria: 'litio' })).toBe('60V · 1 batería de litio');
    expect(textoEnergia({ voltaje_sistema: 72, cantidad_baterias_12v: 2, tipo_bateria: 'litio' })).toBe('72V · 2 baterías de litio');
    expect(textoEnergia({ voltaje_sistema: 60, cantidad_baterias_12v: 5, tipo_bateria: 'plomo_12v' })).toBe('60V · 5 baterías');
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

  it('cada categoría tiene su texto', () => {
    expect(textoCategoria('bicimoto')).toBe('Bicimoto');
    expect(textoCategoria('trimoto_carga')).toBe('Trimoto de carga');
    expect(textoCategoria(null)).toBe('Sin categoría');
  });
});

describe('color por modelo', () => {
  const REALES = ['XSDU-17', 'XSDU-23', 'XSDU-24', 'XSDU-25', 'XSDU-29', 'XSDU-31', 'XSDU-35', 'XSDU-36'];

  it('los 8 modelos reales tienen colores distintos', () => {
    expect(new Set(REALES.map(indiceColorModelo)).size).toBe(REALES.length);
  });

  it('es estable: depende solo del código, sin mayúsculas ni espacios', () => {
    expect(indiceColorModelo(' xsdu-29 ')).toBe(indiceColorModelo('XSDU-29'));
    expect(estiloColorModelo('XSDU-29')).toBe(PALETA_MODELOS[indiceColorModelo('XSDU-29') ?? -1]);
    expect(indiceColorModelo(null)).toBeNull();
    expect(estiloColorModelo('')).toBeNull();
  });

  it('la paleta no repite tonos y cualquier código cae dentro de ella', () => {
    expect(new Set(PALETA_MODELOS.map((c) => c.split(' ')[0])).size).toBe(PALETA_MODELOS.length);
    for (const codigo of ['DEMO-48', 'DEMO-60', 'DEMO-72', 'Z', 'XSDU-100']) {
      const i = indiceColorModelo(codigo) ?? -1;
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(PALETA_MODELOS.length);
    }
  });
});
