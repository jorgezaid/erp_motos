import { describe, expect, it } from 'vitest';
import {
  agruparPorMesEstimado,
  etiquetaMes,
  filtroMes,
  leerMes,
  MAX_BYTES_COMPROBANTE,
  mesDeGasto,
  mesesDisponibles,
  rangoMes,
  rutaComprobante,
  sumarMontos,
  totalesGastos,
  validarComprobante,
} from './gastos';

describe('mesDeGasto', () => {
  it('RN-23: un realizado cuenta en el mes de su fecha de pago', () => {
    expect(mesDeGasto({ estado: 'realizado', fecha: '2026-10-31', fecha_estimada: '2026-09-15' })).toBe('2026-10');
  });
  it('un planificado cuenta en el mes de su fecha estimada', () => {
    expect(mesDeGasto({ estado: 'planificado', fecha: null, fecha_estimada: '2026-11-05' })).toBe('2026-11');
  });
});

describe('leerMes', () => {
  it('sin valor o con uno inválido usa el mes actual', () => {
    expect(leerMes(undefined, '2026-10')).toBe('2026-10');
    expect(leerMes('2026-13', '2026-10')).toBe('2026-10');
    expect(leerMes('octubre', '2026-10')).toBe('2026-10');
  });
  it('acepta aaaa-mm y "todos" quita el filtro', () => {
    expect(leerMes('2026-02', '2026-10')).toBe('2026-02');
    expect(leerMes('todos', '2026-10')).toBeNull();
  });
});

describe('rangoMes y filtroMes', () => {
  it('va del día 1 al día 1 del mes siguiente, también en diciembre', () => {
    expect(rangoMes('2026-10')).toEqual({ desde: '2026-10-01', hasta: '2026-11-01' });
    expect(rangoMes('2026-12')).toEqual({ desde: '2026-12-01', hasta: '2027-01-01' });
    expect(rangoMes('2026-1')).toBeNull();
  });
  it('filtra los realizados por fecha y los planificados (sin fecha) por fecha estimada', () => {
    expect(filtroMes('2026-10')).toBe(
      'and(fecha.gte.2026-10-01,fecha.lt.2026-11-01),and(fecha.is.null,fecha_estimada.gte.2026-10-01,fecha_estimada.lt.2026-11-01)',
    );
    expect(filtroMes('x')).toBeNull();
  });
});

describe('etiquetaMes y mesesDisponibles', () => {
  it('nombra el mes en español', () => {
    expect(etiquetaMes('2026-10')).toBe('Octubre 2026');
    expect(etiquetaMes('2027-01')).toBe('Enero 2027');
  });
  it('incluye el mes actual y los meses con gastos, sin repetir, del más reciente al más antiguo', () => {
    expect(mesesDisponibles(['2026-08-03', null, '2026-12-01', '2026-08-30'], '2026-10')).toEqual(['2026-12', '2026-10', '2026-08']);
  });
});

describe('totalesGastos', () => {
  it('suma por estado y por categoría sin errores de coma flotante', () => {
    const t = totalesGastos([
      { estado: 'realizado', categoria: 'servicios', monto_pen: 0.1 },
      { estado: 'realizado', categoria: 'servicios', monto_pen: 0.2 },
      { estado: 'planificado', categoria: 'alquiler', monto_pen: '1500.00' },
      { estado: 'realizado', categoria: 'alquiler', monto_pen: 1500 },
    ]);
    expect(t).toMatchObject({ cantidad: 4, realizado: '1500.30', planificado: '1500.00', total: '3000.30' });
    expect(t.porCategoria).toEqual([
      { categoria: 'alquiler', realizado: '1500.00', planificado: '1500.00', total: '3000.00' },
      { categoria: 'servicios', realizado: '0.30', planificado: '0.00', total: '0.30' },
    ]);
  });
  it('sin gastos todo es cero', () => {
    expect(totalesGastos([])).toEqual({ cantidad: 0, realizado: '0.00', planificado: '0.00', total: '0.00', porCategoria: [] });
  });
});

describe('agruparPorMesEstimado', () => {
  it('agrupa por mes estimado en orden, con el total de cada mes', () => {
    const grupos = agruparPorMesEstimado([
      { id: 'b', fecha_estimada: '2026-12-20', monto_pen: 100.1 },
      { id: 'a', fecha_estimada: '2026-11-15', monto_pen: 50 },
      { id: 'c', fecha_estimada: '2026-12-01', monto_pen: 0.2 },
    ]);
    expect(grupos.map((g) => [g.mes, g.total, g.filas.map((f) => f.id)])).toEqual([
      ['2026-11', '50.00', ['a']],
      ['2026-12', '100.30', ['c', 'b']],
    ]);
    expect(sumarMontos(grupos.flatMap((g) => g.filas))).toBe('150.30');
  });
});

describe('comprobante (RN-24)', () => {
  it('acepta PDF e imágenes de hasta 5 MB', () => {
    expect(validarComprobante({ name: 'f.pdf', size: 1000, type: 'application/pdf' })).toBeNull();
    expect(validarComprobante({ name: 'f.jpg', size: MAX_BYTES_COMPROBANTE, type: 'image/jpeg' })).toBeNull();
  });
  it('rechaza otros tipos, archivos vacíos y los de más de 5 MB', () => {
    expect(validarComprobante({ name: 'f.exe', size: 10, type: 'application/x-msdownload' })).toMatch(/solo se aceptan/);
    expect(validarComprobante({ name: 'f.png', size: 0, type: 'image/png' })).toMatch(/vacío/);
    expect(validarComprobante({ name: 'f.png', size: MAX_BYTES_COMPROBANTE + 1, type: 'image/png' })).toMatch(/5 MB/);
  });
  it('la ruta queda dentro de la carpeta del gasto y sin caracteres raros', () => {
    expect(rutaComprobante('g1', 'Recibo Luz Octubre ñandú.PDF', 123)).toBe('g1/123-recibo-luz-octubre-nandu.pdf');
    expect(rutaComprobante('g1', '../../otro/archivo.png', 1)).toBe('g1/1-otro-archivo.png');
    expect(rutaComprobante('g1', '???', 1)).toBe('g1/1-comprobante');
  });
});
