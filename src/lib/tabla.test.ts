import { describe, expect, it } from 'vitest';
import { aCsv, filtroBusqueda, leerParams, queryString, rango, valorPermitido } from './tabla';

describe('leerParams y rango (SPEC §11: paginación de 50 filas en el servidor)', () => {
  it('lee q, estado y página con valores por defecto', () => {
    expect(leerParams({})).toEqual({ q: '', estado: '', pagina: 1 });
    expect(leerParams({ q: '  LXY ', estado: 'vendido', pagina: '3' })).toEqual({ q: 'LXY', estado: 'vendido', pagina: 3 });
    expect(leerParams({ pagina: '-2' }).pagina).toBe(1);
    expect(leerParams({ pagina: 'x' }).pagina).toBe(1);
  });

  it('rango de 50 filas', () => {
    expect(rango(1)).toEqual([0, 49]);
    expect(rango(3)).toEqual([100, 149]);
  });
});

describe('filtroBusqueda', () => {
  it('arma un filtro or con ilike', () => {
    expect(filtroBusqueda('lxy', ['vin_chasis', 'nro_motor'])).toBe('vin_chasis.ilike.*lxy*,nro_motor.ilike.*lxy*');
  });

  it('no permite inyectar sintaxis de PostgREST ni comodines', () => {
    expect(filtroBusqueda('a,estado.eq.vendido)', ['vin_chasis'])).toBe('vin_chasis.ilike.*a estado.eq.vendido*');
    expect(filtroBusqueda('50%_', ['x'])).toBe('x.ilike.*50\\%\\_*');
    expect(filtroBusqueda('  ', ['x'])).toBeNull();
  });
});

describe('valorPermitido', () => {
  it('solo acepta valores conocidos', () => {
    expect(valorPermitido('vendido', ['vendido', 'reservado'] as const)).toBe('vendido');
    expect(valorPermitido('otro', ['vendido'] as const)).toBeNull();
  });
});

describe('aCsv (SPEC §10: exportación a CSV)', () => {
  type F = { vin: string; precio: string; nota: string | null };
  const columnas = [
    { encabezado: 'VIN', valor: (f: F) => f.vin },
    { encabezado: 'Precio', valor: (f: F) => f.precio },
    { encabezado: 'Nota', valor: (f: F) => f.nota },
  ];

  it('incluye BOM, encabezados y CRLF; escapa comas y comillas', () => {
    const csv = aCsv([{ vin: 'LX1', precio: '5805.89', nota: 'dice "hola", ok' }], columnas);
    expect(csv).toBe('﻿VIN,Precio,Nota\r\nLX1,5805.89,"dice ""hola"", ok"\r\n');
  });

  it('neutraliza fórmulas de Excel pero no números negativos', () => {
    const csv = aCsv([{ vin: '=HYPERLINK("x")', precio: '-50.00', nota: null }], columnas);
    expect(csv).toContain(`"'=HYPERLINK(""x"")",-50.00,`);
  });
});

describe('queryString', () => {
  it('omite vacíos y la página 1', () => {
    expect(queryString({ q: 'lx', estado: '', pagina: 1 })).toBe('?q=lx');
    expect(queryString({ pagina: 2 })).toBe('?pagina=2');
    expect(queryString({})).toBe('');
  });
});
