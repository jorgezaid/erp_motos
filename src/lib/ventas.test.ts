import { describe, expect, it } from 'vitest';
import {
  esquemaCliente,
  esquemaPago,
  analizarCliente,
  antiguedad,
  avisoBorradores,
  documentoValido,
  faltanParaEscala,
  filtrarUnidades,
  motosReservadas,
  puedeEditarOrden,
  type OrdenDelCliente,
  metodoDerivado,
  motivosNoConfirmable,
  normalizarBusqueda,
  saldoPendiente,
  sumar,
} from './ventas';

describe('borradores y clientes conocidos (SPEC M6)', () => {
  // 16/10/2026 10:00 en Lima
  const ahora = new Date('2026-10-16T15:00:00Z');
  const orden = (o: Partial<OrdenDelCliente>): OrdenDelCliente => ({
    id: 'o',
    numero: 1,
    estado: 'confirmada',
    created_at: '2026-10-01T15:00:00Z',
    vendedor_id: 'v1',
    vendedor: 'Victor Vendedor',
    cliente_nombre: 'Juan Pérez',
    cliente_telefono: null,
    cliente_email: null,
    motos: 0,
    ...o,
  });

  it('antigüedad por días de calendario de Lima', () => {
    expect(antiguedad('2026-10-16T06:00:00Z', ahora)).toBe('hoy'); // 01:00 en Lima
    expect(antiguedad('2026-10-16T04:00:00Z', ahora)).toBe('ayer'); // 23:00 del 15 en Lima
    expect(antiguedad('2026-10-13T15:00:00Z', ahora)).toBe('hace 3 días');
  });

  it('motos reservadas en singular y plural', () => {
    expect(motosReservadas(0)).toBe('sin motos reservadas');
    expect(motosReservadas(1)).toBe('1 moto reservada');
    expect(motosReservadas(4)).toBe('4 motos reservadas');
  });

  it('can_edit_order: el admin continúa cualquier borrador; el vendedor solo los suyos', () => {
    expect(puedeEditarOrden({ vendedor_id: 'v2' }, { userId: 'a', esAdmin: true })).toBe(true);
    expect(puedeEditarOrden({ vendedor_id: 'v1' }, { userId: 'v1', esAdmin: false })).toBe(true);
    expect(puedeEditarOrden({ vendedor_id: 'v2' }, { userId: 'v1', esAdmin: false })).toBe(false);
  });

  it('RN-20: documento válido igual que el CHECK de la BD', () => {
    expect(documentoValido('DNI', '12345678')).toBe(true);
    expect(documentoValido('DNI', '1234567')).toBe(false);
    expect(documentoValido('RUC', '20123456789')).toBe(true);
    expect(documentoValido('RUC', '30123456789')).toBe(false);
    expect(documentoValido('CE', 'AB123456')).toBe(true);
  });

  it('detecta el borrador más reciente del cliente con su antigüedad y motos reservadas', () => {
    const r = analizarCliente(
      [
        orden({ id: 'b-viejo', numero: 3, estado: 'borrador', created_at: '2026-10-05T15:00:00Z' }),
        orden({ id: 'b', numero: 7, estado: 'borrador', created_at: '2026-10-13T15:00:00Z', motos: 2 }),
        orden({ numero: 2 }),
      ],
      { userId: 'v1', esAdmin: false },
      ahora,
    );
    expect(r.borrador).toEqual({ id: 'b', numero: 7, vendedor: 'Victor Vendedor', puedeContinuar: true, antiguedad: 'hace 3 días', motos: 2 });
  });

  it('el borrador de otro vendedor se avisa sin poder continuarlo; el admin sí puede', () => {
    const ordenes = [orden({ estado: 'borrador', vendedor_id: 'v2', vendedor: 'Otra Vendedora' })];
    expect(analizarCliente(ordenes, { userId: 'v1', esAdmin: false }, ahora).borrador?.puedeContinuar).toBe(false);
    expect(analizarCliente(ordenes, { userId: 'admin', esAdmin: true }, ahora).borrador?.puedeContinuar).toBe(true);
  });

  it('autocompleta con la venta más reciente no anulada', () => {
    const r = analizarCliente(
      [
        orden({ numero: 1, created_at: '2026-09-01T15:00:00Z', cliente_nombre: 'Juan P.', cliente_telefono: '999111222' }),
        orden({ numero: 5, created_at: '2026-10-10T15:00:00Z', cliente_nombre: 'Juan Pérez', cliente_email: 'juan@correo.pe' }),
        orden({ numero: 9, estado: 'anulada', created_at: '2026-10-15T15:00:00Z', cliente_nombre: 'Error' }),
      ],
      { userId: 'v1', esAdmin: false },
      ahora,
    );
    expect(r.borrador).toBeNull();
    expect(r.datos).toEqual({ numero: 5, nombre: 'Juan Pérez', telefono: '', email: 'juan@correo.pe' });
  });

  it('un cliente nuevo no tiene borrador ni datos', () => {
    expect(analizarCliente([], { userId: 'v1', esAdmin: false }, ahora)).toEqual({ borrador: null, datos: null });
  });

  it('aviso del Inicio: N borradores, el más antiguo y las motos reservadas', () => {
    expect(avisoBorradores([], ahora)).toBeNull();
    expect(avisoBorradores([{ created_at: '2026-10-16T14:00:00Z', motos: 1 }], ahora)).toBe(
      'Tienes 1 venta en borrador (creada hoy; 1 moto reservada).',
    );
    expect(
      avisoBorradores(
        [
          { created_at: '2026-10-15T15:00:00Z', motos: 2 },
          { created_at: '2026-10-11T15:00:00Z', motos: 0 },
          { created_at: '2026-10-16T14:00:00Z', motos: 1 },
        ],
        ahora,
      ),
    ).toBe('Tienes 3 ventas en borrador (la más antigua, hace 5 días; 3 motos reservadas).');
  });
});

describe('búsqueda de unidades del POS (SPEC M6)', () => {
  const unidades = [
    { vin_chasis: 'LXVIN0001', codigo_modelo: 'XSDU-29', color_primario: 'Gris', color_secundario: null },
    { vin_chasis: 'LXVIN0002', codigo_modelo: 'XSDU-29', color_primario: 'Azul Marino', color_secundario: 'Plateado' },
    { vin_chasis: 'LXVIN0003', codigo_modelo: 'XSDU-35', color_primario: 'Marrón', color_secundario: null },
    { vin_chasis: null, codigo_modelo: null, color_primario: null, color_secundario: null },
  ];
  const vins = (q: string) => filtrarUnidades(unidades, q).map((u) => u.vin_chasis);

  it('normaliza a minúsculas y sin tildes', () => {
    expect(normalizarBusqueda('  MARRÓN Ñandú ')).toBe('marron nandu');
  });
  it('no distingue mayúsculas: «xsdu-29 GRIS» encuentra la XSDU-29 gris', () => {
    expect(vins('xsdu-29 GRIS')).toEqual(['LXVIN0001']);
  });
  it('no distingue tildes en ningún sentido', () => {
    expect(vins('marron')).toEqual(['LXVIN0003']);
    expect(vins('Azúl')).toEqual(['LXVIN0002']);
  });
  it('cada palabra puede estar en el VIN, el modelo o cualquiera de los dos colores', () => {
    expect(vins('plateado 29')).toEqual(['LXVIN0002']);
    expect(vins('lxvin000')).toEqual(['LXVIN0001', 'LXVIN0002', 'LXVIN0003']);
    expect(vins('xsdu-29 rojo')).toEqual([]);
  });
  it('sin texto devuelve todas las unidades', () => {
    expect(filtrarUnidades(unidades, '   ')).toHaveLength(4);
  });
});

describe('saldo pendiente (SPEC M6: siempre visible)', () => {
  it('total − Σ pagos con decimal.js', () => {
    expect(saldoPendiente('16287.80', [{ monto_pen: 5000 }, { monto_pen: '11287.80' }])).toBe('0.00');
    expect(saldoPendiente('0.30', [{ monto_pen: 0.1 }, { monto_pen: 0.2 }])).toBe('0.00');
    expect(saldoPendiente(100, [{ monto_pen: 30 }])).toBe('70.00');
    expect(sumar([])).toBe('0.00');
  });
});

describe('RN-14: mínimos por escala', () => {
  it('M6: una orden x6 con 5 unidades muestra "Faltan 1 unidad para precio distribuidor"', () => {
    expect(faltanParaEscala('distribuidor_x6', 5, 6)).toBe('Faltan 1 unidad para precio distribuidor');
  });

  it('plural y escala cumplida', () => {
    expect(faltanParaEscala('mayorista_x3', 1, 3)).toBe('Faltan 2 unidades para precio mayorista');
    expect(faltanParaEscala('mayorista_x3', 3, 3)).toBeNull();
  });

  it('M6: con 5 unidades en x6 no se puede confirmar; con pagos exactos y el mínimo, sí', () => {
    const base = { tipo: 'distribuidor_x6' as const, minimo: 6, total: '26610.36' };
    expect(motivosNoConfirmable({ ...base, unidades: 5, pagos: [{ monto_pen: '22175.30' }] })).toContain(
      'Faltan 1 unidad para precio distribuidor',
    );
    expect(motivosNoConfirmable({ ...base, unidades: 6, pagos: [{ monto_pen: '26610.36' }] })).toEqual([]);
  });

  it('RN-14: los pagos deben sumar exactamente el total', () => {
    const base = { tipo: 'unidad_x1' as const, minimo: 1, unidades: 1, total: '5805.89' };
    expect(motivosNoConfirmable({ ...base, pagos: [{ monto_pen: 5000 }] })).toEqual(['Falta cobrar S/ 805.89']);
    expect(motivosNoConfirmable({ ...base, pagos: [{ monto_pen: 6000 }] })).toEqual(['Los pagos exceden el total en S/ 194.11']);
    expect(motivosNoConfirmable({ ...base, unidades: 0, total: 0, pagos: [] })).toEqual(['Agrega al menos una unidad']);
  });

  it('D31: con la escala desactivada no se confirma y no se muestra "Faltan N unidades"', () => {
    const base = { tipo: 'mayorista_x3' as const, minimo: 3, unidades: 1, total: '4912.68', pagos: [{ monto_pen: '4912.68' }] };
    expect(motivosNoConfirmable({ ...base, activa: false })).toEqual([
      'La venta mayorista está desactivada: cambia el tipo de venta',
    ]);
    expect(motivosNoConfirmable({ ...base, activa: true })).toEqual(['Faltan 2 unidades para precio mayorista']);
  });
});

describe('RN-15: método de pago derivado', () => {
  it('uno o mixto', () => {
    expect(metodoDerivado([])).toBeNull();
    expect(metodoDerivado([{ metodo: 'efectivo' }, { metodo: 'efectivo' }])).toBe('efectivo');
    expect(metodoDerivado([{ metodo: 'efectivo' }, { metodo: 'tarjeta' }])).toBe('mixto');
  });
});

describe('RN-20: documento del cliente', () => {
  const base = { cliente_nombre: 'Juana Pérez', cliente_telefono: '', cliente_email: '' };
  const valido = (tipo: 'DNI' | 'RUC' | 'CE', doc: string) =>
    esquemaCliente.safeParse({ ...base, cliente_tipo_documento: tipo, cliente_documento: doc }).success;

  it('DNI de 8 dígitos', () => {
    expect(valido('DNI', '45678912')).toBe(true);
    expect(valido('DNI', '4567891')).toBe(false);
    expect(valido('DNI', '4567891A')).toBe(false);
  });

  it('RUC de 11 dígitos que empieza por 10, 15, 17 o 20', () => {
    for (const ruc of ['10456789123', '15456789123', '17456789123', '20456789123']) expect(valido('RUC', ruc)).toBe(true);
    expect(valido('RUC', '30456789123')).toBe(false);
    expect(valido('RUC', '2045678912')).toBe(false);
  });

  it('CE alfanumérico de 8 a 12 (se normaliza a mayúsculas)', () => {
    expect(valido('CE', 'ab123456')).toBe(true);
    expect(valido('CE', 'AB12345')).toBe(false);
    expect(valido('CE', 'AB-1234567')).toBe(false);
  });

  it('el mensaje indica la regla del tipo elegido', () => {
    const r = esquemaCliente.safeParse({ ...base, cliente_tipo_documento: 'RUC', cliente_documento: '123' });
    expect(r.error?.issues[0]?.message).toBe('RUC: 11 dígitos que empiezan por 10, 15, 17 o 20.');
  });

  it('email y teléfono opcionales', () => {
    expect(esquemaCliente.parse({ ...base, cliente_tipo_documento: 'DNI', cliente_documento: '45678912' })).toMatchObject({
      cliente_telefono: null,
      cliente_email: null,
    });
    expect(
      esquemaCliente.safeParse({ ...base, cliente_email: 'x@', cliente_tipo_documento: 'DNI', cliente_documento: '45678912' }).success,
    ).toBe(false);
  });
});

describe('esquemaPago', () => {
  it('monto > 0 con 2 decimales', () => {
    expect(esquemaPago.parse({ metodo: 'efectivo', monto: '5 000,50', referencia: '' })).toEqual({
      metodo: 'efectivo',
      monto: '5000.50',
      referencia: null,
    });
    expect(esquemaPago.safeParse({ metodo: 'efectivo', monto: '0', referencia: '' }).success).toBe(false);
    expect(esquemaPago.safeParse({ metodo: 'mixto', monto: '10', referencia: '' }).success).toBe(false);
  });
});
