import { describe, expect, it } from 'vitest';
import { moduloActivo, modulosPara } from './navegacion';

const hrefs = (rol: Parameters<typeof modulosPara>[0]) => modulosPara(rol).map((m) => m.href);

describe('modulosPara (SPEC M1: sidebar según el rol)', () => {
  it('admin ve todos los módulos', () => {
    expect(hrefs('admin')).toHaveLength(14);
  });

  it('RN-24: "Gastos" solo para admin', () => {
    expect(hrefs('admin')).toContain('/gastos');
    expect(hrefs('tecnico')).not.toContain('/gastos');
    expect(hrefs('vendedor')).not.toContain('/gastos');
  });

  it('D33: "Importar Excel" solo para admin, en Administración', () => {
    expect(modulosPara('admin').find((m) => m.href === '/admin/importar')).toMatchObject({
      etiqueta: 'Importar Excel',
      grupo: 'administracion',
    });
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
