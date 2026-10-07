import { describe, expect, it } from 'vitest';
import { mensajeDeError, sinFilasAfectadas } from './errores';

describe('mensajeDeError (SPEC §11: los mensajes de la BD se muestran tal cual)', () => {
  it('muestra tal cual los mensajes de los triggers (P0001)', () => {
    const message = 'Unidad ABC: requiere una inspección técnica aprobada (la última está observada o no existe)';
    expect(mensajeDeError({ code: 'P0001', message })).toBe(message);
  });

  it('muestra tal cual los 42501 lanzados por triggers en español', () => {
    expect(mensajeDeError({ code: '42501', message: 'Solo un administrador puede anular una venta confirmada' })).toBe(
      'Solo un administrador puede anular una venta confirmada',
    );
  });

  it('traduce el rechazo de RLS', () => {
    expect(
      mensajeDeError({ code: '42501', message: 'new row violates row-level security policy for table "sales_orders"' }),
    ).toBe('No tienes permiso para realizar esta acción.');
  });

  it('RN-03: un VIN repetido indica el campo y el valor', () => {
    expect(
      mensajeDeError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "vehicle_inventory_vin_chasis_key"',
        details: 'Key (vin_chasis)=(LXYZ123) already exists.',
      }),
    ).toBe('El VIN "LXYZ123" ya está registrado.');
  });

  it('RN-03: con RLS (sin detalle) deduce el campo del nombre de la restricción', () => {
    expect(
      mensajeDeError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "vehicle_models_codigo_modelo_key"',
        details: null,
      }),
    ).toBe('El código de modelo ya está registrado.');
    expect(
      mensajeDeError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "vehicle_batteries_serial_key"',
      }),
    ).toBe('El serial de batería ya está registrado.');
  });

  it('RN-20: documento inválido', () => {
    expect(
      mensajeDeError({
        code: '23514',
        message: 'new row for relation "sales_orders" violates check constraint "documento_valido"',
      }),
    ).toMatch(/DNI tiene 8 dígitos/);
  });

  it('M2: no se crea un modelo de 36V', () => {
    expect(
      mensajeDeError({
        code: '23514',
        message: 'new row for relation "vehicle_models" violates check constraint "vehicle_models_voltaje_sistema_check"',
      }),
    ).toBe('El voltaje debe ser 48V, 60V o 72V.');
  });

  it('traduce las credenciales inválidas de Supabase Auth', () => {
    expect(mensajeDeError({ message: 'Invalid login credentials' })).toBe('Email o contraseña incorrectos.');
  });

  it('nunca devuelve un error técnico en inglés', () => {
    expect(mensajeDeError({ code: 'XX000', message: 'internal error' })).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo.',
    );
    expect(mensajeDeError(null)).toMatch(/inesperado/);
  });
});

describe('sinFilasAfectadas (RLS silencioso)', () => {
  it('detecta 0 filas o null', () => {
    expect(sinFilasAfectadas([])).toBe(true);
    expect(sinFilasAfectadas(null)).toBe(true);
    expect(sinFilasAfectadas([{ id: 1 }])).toBe(false);
  });
});
