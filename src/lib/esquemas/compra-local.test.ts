import { describe, expect, it } from 'vitest';
import {
  codigoCompraLocal,
  esquemaCostosCompraLocal,
  esquemaDatosCompraLocal,
  esquemaItemCompraLocal,
  esquemaNuevaCompraLocal,
  PROVEEDOR_NUEVO,
} from './compra-local';

const UUID = '6f1c1d1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f';

describe('codigoCompraLocal (D41)', () => {
  it('sugiere CL-<factura> en mayúsculas y sin espacios', () => {
    expect(codigoCompraLocal('f001 - 123')).toBe('CL-F001-123');
    expect(codigoCompraLocal('  ')).toBe('');
  });
});

describe('esquemaNuevaCompraLocal (D41)', () => {
  const base = {
    proveedor_id: UUID,
    proveedor_nombre: '',
    proveedor_ruc: '',
    nro_factura: 'f001-123',
    codigo_embarque: 'cl-f001-123',
    fecha_compra: '2026-10-20',
    precio_incluye_igv: true,
  };

  it('con un proveedor existente basta elegirlo', () => {
    const r = esquemaNuevaCompraLocal.parse(base);
    expect(r.codigo_embarque).toBe('CL-F001-123');
    expect(r.nro_factura).toBe('F001-123');
  });

  it('el proveedor y la fecha de compra son obligatorios', () => {
    expect(esquemaNuevaCompraLocal.safeParse({ ...base, proveedor_id: '' }).success).toBe(false);
    const r = esquemaNuevaCompraLocal.safeParse({ ...base, fecha_compra: '' });
    expect(r.error?.issues[0]?.path).toEqual(['fecha_compra']);
  });

  it('un proveedor nuevo pide nombre y, si hay RUC, 11 dígitos', () => {
    const nuevo = { ...base, proveedor_id: PROVEEDOR_NUEVO };
    expect(esquemaNuevaCompraLocal.safeParse({ ...nuevo, proveedor_nombre: 'Luna Importaciones' }).success).toBe(true);
    expect(esquemaNuevaCompraLocal.safeParse(nuevo).error?.issues[0]?.path).toEqual(['proveedor_nombre']);
    const r = esquemaNuevaCompraLocal.safeParse({ ...nuevo, proveedor_nombre: 'Luna', proveedor_ruc: '2061' });
    expect(r.error?.issues[0]?.path).toEqual(['proveedor_ruc']);
  });
});

describe('esquemaDatosCompraLocal (D41)', () => {
  const datos = {
    codigo_embarque: 'CL-F001-123',
    nro_factura: 'F001-123',
    proveedor_id: UUID,
    fecha_compra: '2026-10-20',
    fecha_llegada: '2026-10-22',
    estado: 'en_almacen',
    notas: '',
  } as const;

  it('una compra local no pasa por aduanas', () => {
    expect(esquemaDatosCompraLocal.safeParse(datos).success).toBe(true);
    expect(esquemaDatosCompraLocal.safeParse({ ...datos, estado: 'en_aduanas' }).success).toBe(false);
    expect(esquemaDatosCompraLocal.safeParse({ ...datos, estado: 'liquidado' }).success).toBe(false);
  });

  it('la llegada no es anterior a la compra', () => {
    const r = esquemaDatosCompraLocal.safeParse({ ...datos, fecha_llegada: '2026-10-01' });
    expect(r.error?.issues[0]?.path).toEqual(['fecha_llegada']);
  });
});

describe('esquemaCostosCompraLocal y esquemaItemCompraLocal (D41)', () => {
  it('montos en soles con 2 decimales', () => {
    const costos = {
      precio_incluye_igv: true,
      impuestos_recuperables_al_costo: true,
      flete_nacional_pen: '1000',
      otros_gastos_pen: '100,50',
      costo_armado_unitario_pen: '50',
    };
    expect(esquemaCostosCompraLocal.parse(costos).otros_gastos_pen).toBe('100.50');
    expect(esquemaCostosCompraLocal.safeParse({ ...costos, flete_nacional_pen: '-1' }).success).toBe(false);
  });

  it('cada ítem lleva cantidad entera y precio unitario mayor que 0', () => {
    const item = { model_id: UUID, cantidad_packing_list: '4', precio_compra_unitario_pen: '5900' };
    expect(esquemaItemCompraLocal.parse(item)).toEqual({ ...item, cantidad_packing_list: 4 });
    expect(esquemaItemCompraLocal.safeParse({ ...item, cantidad_packing_list: '0' }).success).toBe(false);
    expect(esquemaItemCompraLocal.safeParse({ ...item, precio_compra_unitario_pen: '0' }).success).toBe(false);
  });
});
