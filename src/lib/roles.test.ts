import { describe, expect, it } from 'vitest';
import { decidirRuta, destinoSeguro, puedeVer } from './roles';

describe('decidirRuta (SPEC M1)', () => {
  it('M1: sin sesión redirige a /login conservando la ruta pedida', () => {
    expect(decidirRuta('/ventas/nueva', false, null)).toEqual({
      tipo: 'redirigir',
      destino: '/login?next=%2Fventas%2Fnueva',
    });
    expect(decidirRuta('/', false, null)).toEqual({ tipo: 'redirigir', destino: '/login' });
    expect(decidirRuta('/login', false, null)).toEqual({ tipo: 'seguir' });
  });

  it('M1: un usuario sin rol (o desactivado) solo ve /pendiente', () => {
    expect(decidirRuta('/', true, null)).toEqual({ tipo: 'redirigir', destino: '/pendiente' });
    expect(decidirRuta('/lotes', true, null)).toEqual({ tipo: 'redirigir', destino: '/pendiente' });
    expect(decidirRuta('/pendiente', true, null)).toEqual({ tipo: 'seguir' });
    expect(decidirRuta('/login', true, null)).toEqual({ tipo: 'redirigir', destino: '/pendiente' });
  });

  it('con rol, /login y /pendiente llevan al inicio', () => {
    expect(decidirRuta('/login', true, 'vendedor')).toEqual({ tipo: 'redirigir', destino: '/' });
    expect(decidirRuta('/pendiente', true, 'tecnico')).toEqual({ tipo: 'redirigir', destino: '/' });
  });

  it('una ruta no permitida para el rol lleva al inicio', () => {
    expect(decidirRuta('/lotes/123', true, 'vendedor')).toEqual({ tipo: 'redirigir', destino: '/' });
    expect(decidirRuta('/lotes/123', true, 'admin')).toEqual({ tipo: 'seguir' });
  });
});

describe('puedeVer (SPEC §3)', () => {
  it('RN-24: gastos (y planificados) solo admin', () => {
    for (const ruta of ['/gastos', '/gastos/planificados', '/gastos/csv']) {
      expect(puedeVer(ruta, 'admin')).toBe(true);
      expect(puedeVer(ruta, 'tecnico')).toBe(false);
      expect(puedeVer(ruta, 'vendedor')).toBe(false);
    }
  });

  it('costos (lotes, auditoría) y administración: solo admin', () => {
    for (const ruta of ['/lotes', '/auditoria', '/admin/usuarios', '/admin/importar']) {
      expect(puedeVer(ruta, 'admin')).toBe(true);
      expect(puedeVer(ruta, 'tecnico')).toBe(false);
      expect(puedeVer(ruta, 'vendedor')).toBe(false);
    }
  });

  it('el técnico no ve precios ni ventas; sí taller y registro', () => {
    expect(puedeVer('/precios', 'tecnico')).toBe(false);
    expect(puedeVer('/ventas/nueva', 'tecnico')).toBe(false);
    expect(puedeVer('/taller/abc', 'tecnico')).toBe(true);
    expect(puedeVer('/inventario/registro', 'tecnico')).toBe(true);
  });

  it('el vendedor ve inventario, precios y ventas, pero no el registro de unidades', () => {
    expect(puedeVer('/inventario', 'vendedor')).toBe(true);
    expect(puedeVer('/inventario/registro', 'vendedor')).toBe(false);
    expect(puedeVer('/precios', 'vendedor')).toBe(true);
    expect(puedeVer('/ventas/5', 'vendedor')).toBe(true);
  });

  it('el prefijo coincide por segmento completo (/lotesx no es /lotes)', () => {
    expect(puedeVer('/lotesx', 'vendedor')).toBe(true);
  });

  it('sin rol no ve nada', () => {
    expect(puedeVer('/', null)).toBe(false);
  });
});

describe('destinoSeguro', () => {
  it('solo admite rutas internas', () => {
    expect(destinoSeguro('/ventas')).toBe('/ventas');
    expect(destinoSeguro('https://malo.com')).toBe('/');
    expect(destinoSeguro('//malo.com')).toBe('/');
    expect(destinoSeguro('/\\malo.com')).toBe('/');
    expect(destinoSeguro(null)).toBe('/');
  });
});
