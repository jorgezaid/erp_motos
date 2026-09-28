import { describe, expect, it } from 'vitest';
import { Decimal } from '@/lib/decimal';
import {
  calcularCostoTotalPen,
  calcularCostoUnitarioPen,
  calcularProrrateo,
  ErrorProrrateo,
  type CodigoErrorProrrateo,
  type FilaCosteo,
  type LineaCosteo,
  type LoteCosteo,
} from './prorrateo';

const COLUMNAS_PRORRATEADAS = [
  ['fob_asignado_usd', 'fob_total_usd'],
  ['impuestos_asignados_pen', 'impuestos_asignables_pen'],
  ['flete_internacional_asignado_usd', 'flete_internacional_usd'],
  ['gastos_agente_asignado_usd', 'gastos_agente_usd'],
  ['flete_nacional_asignado_pen', 'flete_nacional_pen'],
  ['alquiler_asignado_pen', 'alquiler_periodo_pen'],
  ['sueldos_asignado_pen', 'sueldos_periodo_pen'],
  ['publicidad_asignada_pen', 'publicidad_inicial_pen'],
] as const;

// Caso de referencia de SPEC §7.
const LOTE_GOLDEN: LoteCosteo = {
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

const LINEAS_GOLDEN: LineaCosteo[] = [
  { model_id: 'id-72', codigo_modelo: 'TEST-72', cantidad_packing_list: 2, exw_total_usd: '1800', cbm_total: '4.0' },
  { model_id: 'id-48', codigo_modelo: 'TEST-48', cantidad_packing_list: 6, exw_total_usd: '1800', cbm_total: '3.0' },
];

function sumaColumna(filas: FilaCosteo[], columna: (typeof COLUMNAS_PRORRATEADAS)[number][0]) {
  return filas.reduce((s, f) => s.plus(f[columna]), new Decimal(0));
}

function lineaGolden(codigo: string): LineaCosteo {
  const linea = LINEAS_GOLDEN.find((l) => l.codigo_modelo === codigo);
  if (!linea) throw new Error(`No hay línea ${codigo}`);
  return linea;
}

function porModelo(filas: FilaCosteo[], modelId: string): FilaCosteo {
  const fila = filas.find((f) => f.model_id === modelId);
  if (!fila) throw new Error(`No hay fila para ${modelId}`);
  return fila;
}

/** Invariante 1: por concepto, Σ asignado = total del lote, exacto a 4 decimales. */
function verificarInvariante1(lote: LoteCosteo, filas: FilaCosteo[]) {
  for (const [columna, total] of COLUMNAS_PRORRATEADAS) {
    expect(sumaColumna(filas, columna).toFixed(4), columna).toBe(new Decimal(lote[total]).toFixed(4));
  }
}

/** Invariante 2: Σ costo_total_pen = fórmula del lote (tolerancia 0.01, la misma de la RPC). */
function verificarInvariante2(lote: LoteCosteo, lineas: LineaCosteo[], filas: FilaCosteo[]) {
  const tc = new Decimal(lote.tipo_cambio ?? 0);
  const sumaQ = lineas.reduce((s, l) => s + l.cantidad_packing_list, 0);
  const esperado = new Decimal(lote.fob_total_usd)
    .plus(lote.flete_internacional_usd)
    .plus(lote.gastos_agente_usd)
    .times(tc)
    .plus(lote.impuestos_asignables_pen)
    .plus(lote.flete_nacional_pen)
    .plus(lote.alquiler_periodo_pen)
    .plus(lote.sueldos_periodo_pen)
    .plus(lote.publicidad_inicial_pen)
    .plus(new Decimal(lote.costo_armado_unitario_pen).times(sumaQ));
  const suma = filas.reduce((s, f) => s.plus(calcularCostoTotalPen(f)), new Decimal(0));
  expect(suma.minus(esperado).abs().lte('0.01'), `Σ ${suma.toFixed(4)} vs ${esperado.toFixed(4)}`).toBe(true);
}

function capturarError(fn: () => unknown): ErrorProrrateo {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErrorProrrateo) return e;
    throw e;
  }
  throw new Error('Se esperaba un ErrorProrrateo y no se lanzó ninguno');
}

function esperarError(fn: () => unknown, codigo: CodigoErrorProrrateo) {
  const error = capturarError(fn);
  expect(error.codigo).toBe(codigo);
  expect(error.message.length).toBeGreaterThan(0);
  return error;
}

describe('calcularProrrateo · caso de referencia (golden test)', () => {
  const filas = calcularProrrateo(LOTE_GOLDEN, LINEAS_GOLDEN);

  it('RN-06 / SPEC §7: asigna cada concepto con los 4 decimales de la tabla', () => {
    expect(porModelo(filas, 'id-48')).toEqual({
      model_id: 'id-48',
      cantidad: 6,
      tipo_cambio: '3.7800',
      fob_asignado_usd: '3600.0000',
      impuestos_asignados_pen: '1000.0000',
      flete_internacional_asignado_usd: '342.8571',
      gastos_agente_asignado_usd: '85.7143',
      flete_nacional_asignado_pen: '171.4286',
      alquiler_asignado_pen: '750.0000',
      sueldos_asignado_pen: '1500.0000',
      publicidad_asignada_pen: '150.0000',
      armado_pen: '360.0000',
    });
    expect(porModelo(filas, 'id-72')).toEqual({
      model_id: 'id-72',
      cantidad: 2,
      tipo_cambio: '3.7800',
      fob_asignado_usd: '3600.0000',
      impuestos_asignados_pen: '1000.0000',
      flete_internacional_asignado_usd: '457.1429',
      gastos_agente_asignado_usd: '114.2857',
      flete_nacional_asignado_pen: '228.5714',
      alquiler_asignado_pen: '250.0000',
      sueldos_asignado_pen: '500.0000',
      publicidad_asignada_pen: '50.0000',
      armado_pen: '120.0000',
    });
  });

  it('SPEC §7: costo landing unitario TEST-48 = 3193.24 y TEST-72 = 8958.29', () => {
    expect(calcularCostoUnitarioPen(porModelo(filas, 'id-48'))).toBe('3193.24');
    expect(calcularCostoUnitarioPen(porModelo(filas, 'id-72'))).toBe('8958.29');
  });

  it('SPEC §7: costo total del lote = S/ 37 076.00', () => {
    const total = filas.reduce((s, f) => s.plus(calcularCostoTotalPen(f)), new Decimal(0));
    expect(total.toFixed(2)).toBe('37076.00');
  });

  it('devuelve las filas ordenadas por codigo_modelo', () => {
    expect(filas.map((f) => f.model_id)).toEqual(['id-48', 'id-72']);
  });

  it('SPEC §7 invariantes 1 y 2 en el caso de referencia', () => {
    verificarInvariante1(LOTE_GOLDEN, filas);
    verificarInvariante2(LOTE_GOLDEN, LINEAS_GOLDEN, filas);
  });
});

describe('calcularProrrateo · residuo de redondeo', () => {
  // A tiene la mayor cantidad, B el mayor EXW y C el mayor CBM: cada criterio
  // debe mandar su residuo a una línea distinta.
  const LINEAS: LineaCosteo[] = [
    { model_id: 'id-c', codigo_modelo: 'C', cantidad_packing_list: 1, exw_total_usd: '1', cbm_total: '4' },
    { model_id: 'id-a', codigo_modelo: 'A', cantidad_packing_list: 4, exw_total_usd: '1', cbm_total: '1' },
    { model_id: 'id-b', codigo_modelo: 'B', cantidad_packing_list: 1, exw_total_usd: '4', cbm_total: '1' },
  ];

  function loteConTotales(total: string): LoteCosteo {
    return {
      tipo_cambio: '3.78',
      fob_total_usd: total,
      flete_internacional_usd: total,
      gastos_agente_usd: total,
      impuestos_asignables_pen: total,
      flete_nacional_pen: total,
      alquiler_periodo_pen: total,
      sueldos_periodo_pen: total,
      publicidad_inicial_pen: total,
      costo_armado_unitario_pen: '60',
    };
  }

  it('SPEC §7: residuo positivo (+0.0001) a la línea de mayor base de cada criterio', () => {
    // 200 × 1/6 = 33.3333 y 200 × 4/6 = 133.3333 → Σ = 199.9999 → +0.0001 a la base mayor.
    const lote = loteConTotales('200');
    const filas = calcularProrrateo(lote, LINEAS);
    const [a, b, c] = [porModelo(filas, 'id-a'), porModelo(filas, 'id-b'), porModelo(filas, 'id-c')];

    // Valor (EXW): base mayor = B
    expect([a.fob_asignado_usd, b.fob_asignado_usd, c.fob_asignado_usd]).toEqual(['33.3333', '133.3334', '33.3333']);
    expect(b.impuestos_asignados_pen).toBe('133.3334');
    // Volumen (CBM): base mayor = C
    expect([a.flete_internacional_asignado_usd, b.flete_internacional_asignado_usd, c.flete_internacional_asignado_usd])
      .toEqual(['33.3333', '33.3333', '133.3334']);
    expect(c.gastos_agente_asignado_usd).toBe('133.3334');
    expect(c.flete_nacional_asignado_pen).toBe('133.3334');
    // Cantidad: base mayor = A
    expect([a.alquiler_asignado_pen, b.alquiler_asignado_pen, c.alquiler_asignado_pen]).toEqual(['133.3334', '33.3333', '33.3333']);
    expect(a.sueldos_asignado_pen).toBe('133.3334');
    expect(a.publicidad_asignada_pen).toBe('133.3334');

    verificarInvariante1(lote, filas);
  });

  it('SPEC §7: residuo negativo (−0.0001) también va a la línea de mayor base', () => {
    // 100 × 1/6 = 16.6667 y 100 × 4/6 = 66.6667 → Σ = 100.0001 → −0.0001 a la base mayor.
    const lote = loteConTotales('100');
    const filas = calcularProrrateo(lote, LINEAS);
    const [a, b, c] = [porModelo(filas, 'id-a'), porModelo(filas, 'id-b'), porModelo(filas, 'id-c')];

    expect([a.fob_asignado_usd, b.fob_asignado_usd, c.fob_asignado_usd]).toEqual(['16.6667', '66.6666', '16.6667']);
    expect([a.flete_nacional_asignado_pen, b.flete_nacional_asignado_pen, c.flete_nacional_asignado_pen])
      .toEqual(['16.6667', '16.6667', '66.6666']);
    expect([a.sueldos_asignado_pen, b.sueldos_asignado_pen, c.sueldos_asignado_pen]).toEqual(['66.6666', '16.6667', '16.6667']);

    verificarInvariante1(lote, filas);
  });

  it('SPEC §7: con bases empatadas, el residuo va a la primera por codigo_modelo', () => {
    // Todas las bases iguales: 100 / 3 = 33.3333 → +0.0001 a "XSDU-17", aunque llegue última.
    const lineas: LineaCosteo[] = [
      { model_id: 'id-29', codigo_modelo: 'XSDU-29', cantidad_packing_list: 2, exw_total_usd: '500', cbm_total: '1.5' },
      { model_id: 'id-23', codigo_modelo: 'XSDU-23', cantidad_packing_list: 2, exw_total_usd: '500', cbm_total: '1.5' },
      { model_id: 'id-17', codigo_modelo: 'XSDU-17', cantidad_packing_list: 2, exw_total_usd: '500', cbm_total: '1.5' },
    ];
    const lote = loteConTotales('100');
    const filas = calcularProrrateo(lote, lineas);

    expect(filas.map((f) => f.model_id)).toEqual(['id-17', 'id-23', 'id-29']);
    for (const [columna] of COLUMNAS_PRORRATEADAS) {
      expect(filas.map((f) => f[columna]), columna).toEqual(['33.3334', '33.3333', '33.3333']);
    }
    verificarInvariante1(lote, filas);
  });
});

describe('calcularProrrateo · invariante 3 (pureza e independencia del orden)', () => {
  const LINEAS: LineaCosteo[] = [
    { model_id: 'id-1', codigo_modelo: 'M-1', cantidad_packing_list: 7, exw_total_usd: '2100.50', cbm_total: '3.1234' },
    { model_id: 'id-2', codigo_modelo: 'M-2', cantidad_packing_list: 3, exw_total_usd: '999.99', cbm_total: '0.7777' },
    { model_id: 'id-3', codigo_modelo: 'M-3', cantidad_packing_list: 11, exw_total_usd: '4500.01', cbm_total: '5.0001' },
  ];
  function permutaciones<T>(items: readonly T[]): T[][] {
    if (items.length <= 1) return [[...items]];
    return items.flatMap((item, i) =>
      permutaciones([...items.slice(0, i), ...items.slice(i + 1)]).map((resto) => [item, ...resto]),
    );
  }

  it('SPEC §7 invariante 3: las 6 permutaciones de las líneas dan la misma salida', () => {
    const referencia = calcularProrrateo(LOTE_GOLDEN, LINEAS);
    const todas = permutaciones(LINEAS);
    expect(todas).toHaveLength(6);
    for (const lineas of todas) {
      expect(calcularProrrateo(LOTE_GOLDEN, lineas)).toEqual(referencia);
    }
  });

  it('SPEC §7 invariante 3: no modifica sus entradas', () => {
    const lote = structuredClone(LOTE_GOLDEN);
    const lineas = structuredClone(LINEAS);
    calcularProrrateo(lote, lineas);
    expect(lote).toEqual(LOTE_GOLDEN);
    expect(lineas).toEqual(LINEAS);
  });

  it('acepta montos como number, string o Decimal con el mismo resultado', () => {
    const conNumeros: LoteCosteo = { ...LOTE_GOLDEN, tipo_cambio: 3.78, fob_total_usd: 7200, flete_internacional_usd: new Decimal(800) };
    expect(calcularProrrateo(conNumeros, LINEAS_GOLDEN)).toEqual(calcularProrrateo(LOTE_GOLDEN, LINEAS_GOLDEN));
  });
});

describe('calcularProrrateo · errores de dominio', () => {
  it('RN-06: lote sin líneas → SIN_LINEAS', () => {
    esperarError(() => calcularProrrateo(LOTE_GOLDEN, []), 'SIN_LINEAS');
  });

  it('RN-06: sin tipo de cambio → SIN_TIPO_CAMBIO (null, undefined, 0 o negativo)', () => {
    for (const tipo_cambio of [null, undefined, '0', -3.78]) {
      esperarError(() => calcularProrrateo({ ...LOTE_GOLDEN, tipo_cambio }, LINEAS_GOLDEN), 'SIN_TIPO_CAMBIO');
    }
  });

  it('RN-06: Σ EXW = 0 → EXW_CERO', () => {
    const lineas = LINEAS_GOLDEN.map((l) => ({ ...l, exw_total_usd: '0' }));
    esperarError(() => calcularProrrateo(LOTE_GOLDEN, lineas), 'EXW_CERO');
  });

  it('RN-06: Σ CBM = 0 → CBM_CERO', () => {
    const lineas = LINEAS_GOLDEN.map((l) => ({ ...l, cbm_total: 0 }));
    esperarError(() => calcularProrrateo(LOTE_GOLDEN, lineas), 'CBM_CERO');
  });

  it('LOTE_INVALIDO: monto negativo, no numérico o con más decimales que la BD', () => {
    esperarError(() => calcularProrrateo({ ...LOTE_GOLDEN, flete_nacional_pen: '-1' }, LINEAS_GOLDEN), 'LOTE_INVALIDO');
    esperarError(() => calcularProrrateo({ ...LOTE_GOLDEN, sueldos_periodo_pen: 'mil' }, LINEAS_GOLDEN), 'LOTE_INVALIDO');
    esperarError(() => calcularProrrateo({ ...LOTE_GOLDEN, alquiler_periodo_pen: Number.NaN }, LINEAS_GOLDEN), 'LOTE_INVALIDO');
    esperarError(() => calcularProrrateo({ ...LOTE_GOLDEN, publicidad_inicial_pen: '10.005' }, LINEAS_GOLDEN), 'LOTE_INVALIDO');
    esperarError(() => calcularProrrateo({ ...LOTE_GOLDEN, tipo_cambio: '3.78001' }, LINEAS_GOLDEN), 'LOTE_INVALIDO');
  });

  it('LOTE_INVALIDO: el mensaje nombra el campo para el usuario', () => {
    const error = esperarError(
      () => calcularProrrateo({ ...LOTE_GOLDEN, flete_nacional_pen: '-1' }, LINEAS_GOLDEN),
      'LOTE_INVALIDO',
    );
    expect(error.message).toContain('flete nacional');
  });

  it('LINEA_INVALIDA: cantidad no entera o ≤ 0, EXW o CBM negativos, escala mayor que la BD, modelo repetido', () => {
    const [l48, l72] = [lineaGolden('TEST-48'), lineaGolden('TEST-72')];
    const casos: LineaCosteo[][] = [
      [{ ...l48, cantidad_packing_list: 0 }, l72],
      [{ ...l48, cantidad_packing_list: 1.5 }, l72],
      [{ ...l48, exw_total_usd: '-0.01' }, l72],
      [{ ...l48, cbm_total: '-1' }, l72],
      [{ ...l48, exw_total_usd: '100.001' }, l72],
      [{ ...l48, cbm_total: '0.00001' }, l72],
      [l48, { ...l72, model_id: l48.model_id }],
      [l48, { ...l72, codigo_modelo: l48.codigo_modelo }],
    ];
    for (const lineas of casos) {
      const error = esperarError(() => calcularProrrateo(LOTE_GOLDEN, lineas), 'LINEA_INVALIDA');
      expect(error.message).toContain('TEST-48');
    }
  });
});

// ---------------------------------------------------------------------------
// Pruebas de propiedades: 200 lotes aleatorios con semilla fija.
// ---------------------------------------------------------------------------

/** mulberry32: PRNG pequeño y determinista (sin dependencias). */
function crearPrng(semilla: number) {
  let a = semilla >>> 0;
  const siguiente = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entero = (min: number, max: number) => min + Math.floor(siguiente() * (max - min + 1));
  /** Monto aleatorio en [0, max] con `decimales` decimales, como string. */
  const monto = (max: number, decimales: number) => new Decimal(entero(0, max * 10 ** decimales)).div(10 ** decimales).toFixed(decimales);
  return { siguiente, entero, monto };
}

function barajar<T>(items: readonly T[], prng: ReturnType<typeof crearPrng>): T[] {
  const resto = [...items];
  const barajados: T[] = [];
  while (resto.length > 0) {
    barajados.push(...resto.splice(prng.entero(0, resto.length - 1), 1));
  }
  return barajados;
}

function loteAleatorio(prng: ReturnType<typeof crearPrng>): { lote: LoteCosteo; lineas: LineaCosteo[] } {
  // Algunos conceptos en 0 (≈ 1 de cada 5) para cubrir lotes incompletos.
  const concepto = (max: number) => (prng.siguiente() < 0.2 ? '0' : prng.monto(max, 2));
  const lote: LoteCosteo = {
    tipo_cambio: new Decimal(prng.entero(30000, 40000)).div(10000).toFixed(4),
    fob_total_usd: concepto(200000),
    flete_internacional_usd: concepto(20000),
    gastos_agente_usd: concepto(5000),
    impuestos_asignables_pen: concepto(150000),
    flete_nacional_pen: concepto(10000),
    alquiler_periodo_pen: concepto(20000),
    sueldos_periodo_pen: concepto(30000),
    publicidad_inicial_pen: concepto(5000),
    costo_armado_unitario_pen: prng.monto(200, 2),
  };
  const cantidadLineas = prng.entero(1, 8);
  const lineas: LineaCosteo[] = [];
  for (let i = 0; i < cantidadLineas; i++) {
    const q = prng.entero(1, 60);
    // Bases unitarias > 0, como exige la BD para el CBM; totales = q × unitario.
    const exwUnitario = new Decimal(prng.entero(100, 500000)).div(100);
    const cbmUnitario = new Decimal(prng.entero(100, 50000)).div(10000);
    lineas.push({
      model_id: `id-${i}`,
      codigo_modelo: `XSDU-${String(prng.entero(0, 99)).padStart(2, '0')}-${i}`,
      cantidad_packing_list: q,
      exw_total_usd: exwUnitario.times(q).toFixed(2),
      cbm_total: cbmUnitario.times(q).toFixed(4),
    });
  }
  return { lote, lineas };
}

describe('calcularProrrateo · propiedades (200 lotes aleatorios, semilla fija)', () => {
  const prng = crearPrng(20260926);
  const casos = Array.from({ length: 200 }, () => loteAleatorio(prng));

  it('SPEC §7 invariantes 1, 2 y 3 en cada lote; asignaciones ≥ 0 con 4 decimales', () => {
    for (const { lote, lineas } of casos) {
      const filas = calcularProrrateo(lote, lineas);
      expect(filas).toHaveLength(lineas.length);

      verificarInvariante1(lote, filas);
      verificarInvariante2(lote, lineas, filas);
      expect(calcularProrrateo(lote, barajar(lineas, prng))).toEqual(filas);

      for (const fila of filas) {
        for (const [columna] of COLUMNAS_PRORRATEADAS) {
          expect(fila[columna]).toMatch(/^\d+\.\d{4}$/);
        }
      }
    }
  });
});
