import { describe, expect, it } from 'vitest';
import {
  calcularMatrizPrecios,
  calcularPrecioSugerido,
  ErrorPrecios,
  type CodigoErrorPrecios,
  type FilaMatrizPrecios,
  type MargenPrecio,
  type PrecioEscala,
} from './precios';
// [costo, margen, round(costo / (1 - margen), 2)] calculado por Postgres (setseed 0.42, 300 casos);
// es la misma expresión que usa public.generar_lista_precios.
import casosPostgres from './precios.postgres.json';

// Seed de supabase/seed.sql
const MARGENES: MargenPrecio[] = [
  { tipo_venta: 'unidad_x1', cantidad_minima: 1, margen_objetivo: '0.4500' },
  { tipo_venta: 'mayorista_x3', cantidad_minima: 3, margen_objetivo: '0.3500' },
  { tipo_venta: 'distribuidor_x6', cantidad_minima: 6, margen_objetivo: '0.2800' },
];

function esperaError(fn: () => unknown, codigo: CodigoErrorPrecios): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorPrecios);
    expect((e as ErrorPrecios).codigo).toBe(codigo);
    return;
  }
  throw new Error(`se esperaba ErrorPrecios ${codigo}`);
}

describe('calcularPrecioSugerido (SPEC §8)', () => {
  it('RN-07: golden test de SPEC §7 — TEST-48 x1/x3/x6 = 5805.89 / 4912.68 / 4435.06', () => {
    expect(calcularPrecioSugerido('3193.24', '0.45')).toBe('5805.89');
    expect(calcularPrecioSugerido('3193.24', '0.35')).toBe('4912.68');
    expect(calcularPrecioSugerido('3193.24', '0.28')).toBe('4435.06');
  });

  it('RN-07: redondea half-up como round(numeric, 2) de Postgres (125.025 → 125.03)', () => {
    expect(calcularPrecioSugerido('100.02', '0.2')).toBe('125.03');
  });

  it('RN-07: coincide con generar_lista_precios en 300 casos calculados por Postgres', () => {
    expect(casosPostgres).toHaveLength(300);
    for (const [costo, margen, precio] of casosPostgres as [string, string, string][]) {
      expect(calcularPrecioSugerido(costo, margen), `${costo} / (1 − ${margen})`).toBe(precio);
    }
  });

  it('margen 0: el precio es el costo', () => {
    expect(calcularPrecioSugerido(1500, 0)).toBe('1500.00');
  });

  it('rechaza costos ≤ 0, no numéricos o con más de 2 decimales', () => {
    for (const c of ['0', '-1', 'abc', '', '10.001']) {
      esperaError(() => calcularPrecioSugerido(c, '0.45'), 'COSTO_INVALIDO');
    }
  });

  it('rechaza márgenes fuera de [0, 1) o con más de 4 decimales', () => {
    for (const m of ['1', '1.2', '-0.1', 'x', '0.12345']) {
      esperaError(() => calcularPrecioSugerido('100', m), 'MARGEN_INVALIDO');
    }
  });
});

describe('calcularMatrizPrecios (vista previa de v_price_matrix)', () => {
  const COSTO_48 = { model_id: 'a', codigo_modelo: 'TEST-48', costo_landing_unitario_pen: '3193.24' };
  const COSTO_72 = { model_id: 'b', codigo_modelo: 'TEST-72', costo_landing_unitario_pen: '8958.29' };
  const COSTOS = [COSTO_72, COSTO_48];

  function precios(matriz: FilaMatrizPrecios[], codigo: string): PrecioEscala[] {
    const fila = matriz.find((f) => f.codigo_modelo === codigo);
    if (!fila) throw new Error(`falta la fila de ${codigo}`);
    return fila.precios;
  }

  it('RN-07: matriz del golden test, ordenada por modelo y por escala x1, x3, x6', () => {
    const matriz = calcularMatrizPrecios(COSTOS, [...MARGENES].reverse());
    expect(matriz.map((f) => f.codigo_modelo)).toEqual(['TEST-48', 'TEST-72']);
    expect(precios(matriz, 'TEST-48').map((p) => [p.tipo_venta, p.precio_venta_pen, p.utilidad_pen])).toEqual([
      ['unidad_x1', '5805.89', '2612.65'],
      ['mayorista_x3', '4912.68', '1719.44'],
      ['distribuidor_x6', '4435.06', '1241.82'],
    ]);
    // Calculados por Postgres: round(8958.29 / (1 − m), 2)
    expect(precios(matriz, 'TEST-72').map((p) => p.precio_sugerido_pen)).toEqual(['16287.80', '13781.98', '12442.07']);
    expect(precios(matriz, 'TEST-48').map((p) => p.cantidad_minima)).toEqual([1, 3, 6]);
  });

  it('el margen real queda en el objetivo (±0.0001 por el redondeo del precio)', () => {
    for (const fila of calcularMatrizPrecios(COSTOS, MARGENES)) {
      for (const p of fila.precios) {
        expect(Math.abs(Number(p.margen_real) - Number(p.margen_objetivo))).toBeLessThanOrEqual(0.0001);
      }
    }
  });

  it('precio_venta_pen = coalesce(precio_manual_pen, precio_sugerido_pen), como la columna generada', () => {
    const matriz = calcularMatrizPrecios(
      [{ ...COSTO_48, precios_manuales: { unidad_x1: '5790', mayorista_x3: null } }],
      MARGENES,
    );
    const [x1, x3] = precios(matriz, 'TEST-48');
    expect(x1).toMatchObject({
      precio_sugerido_pen: '5805.89',
      precio_manual_pen: '5790.00',
      precio_venta_pen: '5790.00',
      utilidad_pen: '2596.76',
    });
    expect(x3).toMatchObject({ precio_manual_pen: null, precio_venta_pen: '4912.68' });
  });

  it('errores: sin márgenes, costo inválido (con el modelo en el mensaje) y precio manual inválido', () => {
    esperaError(() => calcularMatrizPrecios(COSTOS, []), 'SIN_MARGENES');
    expect(() =>
      calcularMatrizPrecios([{ model_id: 'x', codigo_modelo: 'XSDU-17', costo_landing_unitario_pen: '0' }], MARGENES),
    ).toThrow(/^Modelo XSDU-17: /);
    esperaError(
      () => calcularMatrizPrecios([{ ...COSTO_48, precios_manuales: { unidad_x1: '-5' } }], MARGENES),
      'PRECIO_MANUAL_INVALIDO',
    );
  });

  it('es pura: no modifica sus argumentos', () => {
    const costos = structuredClone(COSTOS);
    const margenes = structuredClone(MARGENES);
    calcularMatrizPrecios(costos, margenes);
    expect(costos).toEqual(COSTOS);
    expect(margenes).toEqual(MARGENES);
  });
});
