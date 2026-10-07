import { describe, expect, it } from 'vitest';
import { normalizarSerial, parsearPegado, textoFaltantes, validarFilas } from './registro';

describe('parsearPegado (SPEC M4: pegar desde Excel)', () => {
  it('columnas separadas por tabulador, con encabezado', () => {
    const texto = 'VIN\tMotor\tColor 1\tColor 2\nlxy 001\tm-001\tRojo\tNegro\r\nLXY002\tM-002\tAzul\t\n\n';
    expect(parsearPegado(texto)).toEqual([
      { vin: 'LXY001', motor: 'M-001', color1: 'Rojo', color2: 'Negro' },
      { vin: 'LXY002', motor: 'M-002', color1: 'Azul', color2: null },
    ]);
  });

  it('también acepta punto y coma o coma, y filas sin colores', () => {
    expect(parsearPegado('A1;B1;Blanco\nA2,B2')).toEqual([
      { vin: 'A1', motor: 'B1', color1: 'Blanco', color2: null },
      { vin: 'A2', motor: 'B2', color1: null, color2: null },
    ]);
  });

  it('RN-03: VIN y motor en mayúsculas y sin espacios', () => {
    expect(normalizarSerial(' lx y-12 3 ')).toBe('LXY-123');
  });
});

describe('validarFilas', () => {
  it('exige VIN y motor', () => {
    expect(validarFilas([{ vin: '', motor: 'M1', color1: null, color2: null }])).toEqual([
      { linea: 1, mensaje: 'Falta el VIN.' },
    ]);
  });

  it('RN-03: detecta VIN o motor repetidos en lo pegado', () => {
    const errores = validarFilas([
      { vin: 'V1', motor: 'M1', color1: null, color2: null },
      { vin: 'V1', motor: 'M2', color1: null, color2: null },
      { vin: 'V3', motor: 'M1', color1: null, color2: null },
    ]);
    expect(errores).toEqual([
      { linea: 2, mensaje: 'VIN V1 repetido (también en la fila 1).' },
      { linea: 3, mensaje: 'Motor M1 repetido (también en la fila 1).' },
    ]);
  });

  it('sin errores', () => {
    expect(validarFilas(parsearPegado('V1\tM1\nV2\tM2'))).toEqual([]);
  });
});

describe('textoFaltantes (SPEC M4: "faltan X de Y")', () => {
  it('muestra lo que falta o completo', () => {
    expect(textoFaltantes(5, 3)).toBe('Faltan 2 de 5');
    expect(textoFaltantes(5, 5)).toBe('Completo: 5 de 5');
  });
});
