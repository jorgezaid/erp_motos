import { describe, expect, it } from 'vitest';
import { MODULOS, moduloActivo, modulosPara } from './navegacion';

const hrefs = (rol: Parameters<typeof modulosPara>[0]) => modulosPara(rol).map((m) => m.href);

describe('modulosPara (SPEC M1: sidebar según el rol)', () => {
  it('admin ve todos los módulos', () => {
    expect(hrefs('admin')).toHaveLength(13);
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

  it('técnico: inventario, taller y garantías; sin lotes, precios, ventas ni administración', () => {
    expect(hrefs('tecnico')).toEqual(['/', '/inventario', '/taller', '/garantias']);
  });

  it('D40: "Registro de unidades" no está en el menú (se entra desde /inventario)', () => {
    expect(MODULOS.some((m) => m.href === '/inventario/registro')).toBe(false);
  });

  it('vendedor: inventario, precios, ventas y garantías; sin costos', () => {
    expect(hrefs('vendedor')).toEqual(['/', '/inventario', '/precios', '/ventas', '/garantias']);
  });
});

describe('moduloActivo', () => {
  const modulos = modulosPara('admin');
  it('elige el prefijo más largo', () => {
    // Registro no está en el menú: queda marcado Inventario
    expect(moduloActivo('/inventario/registro', modulos)).toBe('/inventario');
    expect(moduloActivo('/inventario', modulos)).toBe('/inventario');
    expect(moduloActivo('/ventas/nueva', modulos)).toBe('/ventas');
    expect(moduloActivo('/', modulos)).toBe('/');
  });
});
