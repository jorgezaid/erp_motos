import { describe, expect, it } from 'vitest';
import { moduloActivo, modulosPara } from './navegacion';

const hrefs = (rol: Parameters<typeof modulosPara>[0]) => modulosPara(rol).map((m) => m.href);

describe('modulosPara (SPEC M1: sidebar según el rol)', () => {
  it('admin ve todos los módulos', () => {
    expect(hrefs('admin')).toHaveLength(12);
  });

  it('técnico: inventario, registro, taller y garantías; sin lotes, precios, ventas ni administración', () => {
    expect(hrefs('tecnico')).toEqual(['/', '/inventario', '/inventario/registro', '/taller', '/garantias']);
  });

  it('vendedor: inventario, precios, ventas y garantías; sin costos', () => {
    expect(hrefs('vendedor')).toEqual(['/', '/inventario', '/precios', '/ventas', '/garantias']);
  });
});

describe('moduloActivo', () => {
  const modulos = modulosPara('admin');
  it('elige el prefijo más largo', () => {
    expect(moduloActivo('/inventario/registro', modulos)).toBe('/inventario/registro');
    expect(moduloActivo('/inventario', modulos)).toBe('/inventario');
    expect(moduloActivo('/ventas/nueva', modulos)).toBe('/ventas');
    expect(moduloActivo('/', modulos)).toBe('/');
  });
});
