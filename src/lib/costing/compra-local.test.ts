import { describe, expect, it } from 'vitest';
import { Decimal } from '@/lib/decimal';
import { calcularCosteoCompraLocal, totalesCompra, type LineaCompraLocal, type LoteCompraLocal } from './compra-local';
import {
  calcularCostoTotalPen,
  calcularCostoUnitarioPen,
  calcularProrrateo,
  ErrorProrrateo,
  type FilaCosteo,
} from './prorrateo';

// Caso Luna Importaciones (el mismo de tests/test_compra_local.sql)
const luna: LoteCompraLocal = {
  precio_incluye_igv: true,
  igv_al_costo: true,
  flete_nacional_pen: '1000.00',
  otros_gastos_pen: '100.00',
  costo_armado_unitario_pen: '50.00',
};
const lineasLuna: LineaCompraLocal[] = [
  {
    model_id: 't',
    codigo_modelo: 'LUNA-T',
    cantidad_packing_list: 4,
    precio_compra_unitario_pen: '5900.00',
  },
  {
    model_id: 'c',
    codigo_modelo: 'LUNA-C',
    cantidad_packing_list: 2,
    precio_compra_unitario_pen: 7080,
  },
];

function fila(filas: FilaCosteo[], id: string): FilaCosteo {
  const encontrada = filas.find((f) => f.model_id === id);
  if (!encontrada) throw new Error(`Sin fila para ${id}`);
  return encontrada;
}
const suma = (filas: FilaCosteo[], k: keyof FilaCosteo) =>
  Decimal.sum(...filas.map((f) => String(f[k] ?? 0))).toFixed(4);

describe('calcularCosteoCompraLocal (D41) — caso Luna Importaciones', () => {
  it('D41: precio con IGV y IGV al costo → LUNA-T S/ 6 133.33 y LUNA-C S/ 7 313.33', () => {
    const filas = calcularCosteoCompraLocal(luna, lineasLuna);
    expect(filas.map((f) => f.model_id)).toEqual(['c', 't']); // por código
    expect(fila(filas, 't')).toEqual({
      model_id: 't',
      cantidad: 4,
      tipo_cambio: '1.0000',
      fob_asignado_usd: '0.0000',
      impuestos_asignados_pen: '3600.0000',
      flete_internacional_asignado_usd: '0.0000',
      gastos_agente_asignado_usd: '0.0000',
      flete_nacional_asignado_pen: '666.6667',
      alquiler_asignado_pen: '0.0000',
      sueldos_asignado_pen: '0.0000',
      publicidad_asignada_pen: '0.0000',
      armado_pen: '200.0000',
      compra_asignada_pen: '20000.0000',
      otros_gastos_asignado_pen: '66.6667',
    });
    expect(calcularCostoUnitarioPen(fila(filas, 't'))).toBe('6133.33');
    expect(calcularCostoUnitarioPen(fila(filas, 'c'))).toBe('7313.33');
    expect(Decimal.sum(...filas.map(calcularCostoTotalPen)).toFixed(4)).toBe('39160.0000');
  });

  it('D41: IGV como crédito fiscal (no va al costo) → S/ 5 233.33 y S/ 6 233.33', () => {
    const filas = calcularCosteoCompraLocal({ ...luna, igv_al_costo: false }, lineasLuna);
    expect(filas.every((f) => f.impuestos_asignados_pen === '0.0000')).toBe(true);
    expect(calcularCostoUnitarioPen(fila(filas, 't'))).toBe('5233.33');
    expect(calcularCostoUnitarioPen(fila(filas, 'c'))).toBe('6233.33');
  });

  it('D41: precio sin IGV → la compra es el precio y el IGV es el 18 %', () => {
    const filas = calcularCosteoCompraLocal({ ...luna, precio_incluye_igv: false }, lineasLuna);
    expect(fila(filas, 't').compra_asignada_pen).toBe('23600.0000');
    expect(fila(filas, 't').impuestos_asignados_pen).toBe('4248.0000');
    expect(calcularCostoTotalPen(fila(filas, 't'))).toBe('28781.3334');
  });

  it('D41: con IGV incluido, compra + IGV = lo pagado, a 4 decimales', () => {
    const filas = calcularCosteoCompraLocal(luna, [
      {
        model_id: 'x',
        codigo_modelo: 'X',
        cantidad_packing_list: 3,
        precio_compra_unitario_pen: '1234.57',
      },
    ]);
    const f = fila(filas, 'x');
    expect(f.compra_asignada_pen).toBe('3138.7373'); // 3 703.71 / 1.18 = 3 138.73728…
    expect(new Decimal(f.compra_asignada_pen ?? 0).plus(f.impuestos_asignados_pen).toFixed(4)).toBe('3703.7100');
  });
});

describe('calcularCosteoCompraLocal (D41) — invariantes', () => {
  const tres: LineaCompraLocal[] = [
    {
      model_id: 'b',
      codigo_modelo: 'B',
      cantidad_packing_list: 1,
      precio_compra_unitario_pen: 100,
    },
    {
      model_id: 'a',
      codigo_modelo: 'A',
      cantidad_packing_list: 1,
      precio_compra_unitario_pen: 200,
    },
    {
      model_id: 'c',
      codigo_modelo: 'C',
      cantidad_packing_list: 1,
      precio_compra_unitario_pen: 300,
    },
  ];

  it('SPEC §7 inv. 1: flete y otros gastos cuadran; el residuo va a la primera línea en empate', () => {
    const filas = calcularCosteoCompraLocal({ ...luna, flete_nacional_pen: 100, otros_gastos_pen: '10.00' }, tres);
    expect(suma(filas, 'flete_nacional_asignado_pen')).toBe('100.0000');
    expect(suma(filas, 'otros_gastos_asignado_pen')).toBe('10.0000');
    expect(fila(filas, 'a').flete_nacional_asignado_pen).toBe('33.3334');
    expect(fila(filas, 'b').flete_nacional_asignado_pen).toBe('33.3333');
  });

  it('SPEC §7 inv. 1: el residuo va a la línea de mayor cantidad', () => {
    const filas = calcularCosteoCompraLocal({ ...luna, flete_nacional_pen: 100 }, [
      {
        model_id: 'a',
        codigo_modelo: 'A',
        cantidad_packing_list: 1,
        precio_compra_unitario_pen: 1,
      },
      {
        model_id: 'b',
        codigo_modelo: 'B',
        cantidad_packing_list: 2,
        precio_compra_unitario_pen: 1,
      },
    ]);
    expect(fila(filas, 'a').flete_nacional_asignado_pen).toBe('33.3333');
    expect(fila(filas, 'b').flete_nacional_asignado_pen).toBe('66.6667');
  });

  it('SPEC §7 inv. 2: Σ costo total = compra + IGV al costo + flete + otros + armado', () => {
    const filas = calcularCosteoCompraLocal(luna, lineasLuna);
    const esperado = new Decimal(suma(filas, 'compra_asignada_pen'))
      .plus(suma(filas, 'impuestos_asignados_pen'))
      .plus(1000)
      .plus(100)
      .plus(6 * 50);
    expect(Decimal.sum(...filas.map(calcularCostoTotalPen)).toFixed(4)).toBe(esperado.toFixed(4));
  });

  it('SPEC §7 inv. 3: el orden de las líneas no cambia el resultado', () => {
    const lote = {
      ...luna,
      flete_nacional_pen: 100,
      otros_gastos_pen: '10.00',
    };
    expect(calcularCosteoCompraLocal(lote, [...tres].reverse())).toEqual(calcularCosteoCompraLocal(lote, tres));
  });
});

describe('calcularCosteoCompraLocal (D41) — errores', () => {
  it('sin ítems, sin precio o con montos inválidos no se costea', () => {
    expect(() => calcularCosteoCompraLocal(luna, [])).toThrow(ErrorProrrateo);
    expect(() =>
      calcularCosteoCompraLocal(luna, [
        {
          model_id: 'x',
          codigo_modelo: 'X',
          cantidad_packing_list: 1,
          precio_compra_unitario_pen: null,
        },
      ]),
    ).toThrow('Modelo X: indica el precio de compra unitario');
    expect(() => calcularCosteoCompraLocal({ ...luna, flete_nacional_pen: '-1' }, lineasLuna)).toThrow(
      'flete Lima → Arequipa',
    );
    expect(() => calcularCosteoCompraLocal(luna, [...lineasLuna, ...lineasLuna.map((l) => ({ ...l, model_id: `otro-${l.model_id}` }))])).toThrow(
      'aparece más de una vez',
    );
  });
});

describe('importación sin cambios (D41)', () => {
  it('SPEC §7 golden test: calcularProrrateo no trae las columnas de compra local y da lo mismo', () => {
    const filas = calcularProrrateo(
      {
        tipo_cambio: '3.78',
        fob_total_usd: 7200,
        flete_internacional_usd: 800,
        gastos_agente_usd: 200,
        impuestos_asignables_pen: 2000,
        flete_nacional_pen: 400,
        alquiler_periodo_pen: 1000,
        sueldos_periodo_pen: 2000,
        publicidad_inicial_pen: 200,
        costo_armado_unitario_pen: 60,
      },
      [
        {
          model_id: 'm48',
          codigo_modelo: 'TEST-48',
          cantidad_packing_list: 6,
          exw_total_usd: 1800,
          cbm_total: 3,
        },
        {
          model_id: 'm72',
          codigo_modelo: 'TEST-72',
          cantidad_packing_list: 2,
          exw_total_usd: 1800,
          cbm_total: 4,
        },
      ],
    );
    expect(filas.every((f) => !('compra_asignada_pen' in f) && !('otros_gastos_asignado_pen' in f))).toBe(true);
    expect(filas.map(calcularCostoUnitarioPen)).toEqual(['3193.24', '8958.29']);
  });
});

describe('totalesCompra (D41)', () => {
  it('suma unidades y lo pagado por la factura', () => {
    expect(totalesCompra(lineasLuna)).toEqual({ unidades: 6, total: '37760.00' });
    expect(totalesCompra([])).toEqual({ unidades: 0, total: '0.00' });
  });
});
