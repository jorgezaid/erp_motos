import { describe, expect, it } from 'vitest';
import { esquemaColor, normalizarColor, puedeEditarColor, textoColores } from './color';

describe('normalizarColor (D39)', () => {
  it('D39: guarda en MAYÚSCULAS y sin espacios sobrantes', () => {
    expect(normalizarColor('  rojo   oscuro ')).toBe('ROJO OSCURO');
    expect(normalizarColor('Rojo')).toBe(normalizarColor('ROJO'));
    expect(normalizarColor('   ')).toBe('');
  });
});

describe('esquemaColor (D39)', () => {
  it('D39: normaliza y el secundario vacío queda en null', () => {
    expect(esquemaColor.parse({ primario: ' azul ', secundario: 'negro' })).toEqual({ primario: 'AZUL', secundario: 'NEGRO' });
    expect(esquemaColor.parse({ primario: 'gris', secundario: '  ' })).toEqual({ primario: 'GRIS', secundario: null });
  });

  it('D39: exige el primario, distinto del secundario y de hasta 30 caracteres', () => {
    expect(esquemaColor.safeParse({ primario: ' ', secundario: 'rojo' }).success).toBe(false);
    expect(esquemaColor.safeParse({ primario: 'rojo', secundario: ' ROJO' }).success).toBe(false);
    expect(esquemaColor.safeParse({ primario: 'x'.repeat(31), secundario: '' }).success).toBe(false);
  });
});

describe('puedeEditarColor (D39)', () => {
  it('D39: admin siempre; técnico salvo vendida; vendedor nunca', () => {
    expect(puedeEditarColor('admin', 'vendido')).toBe(true);
    expect(puedeEditarColor('tecnico', 'reservado')).toBe(true);
    expect(puedeEditarColor('tecnico', 'vendido')).toBe(false);
    expect(puedeEditarColor('vendedor', 'en_caja')).toBe(false);
  });
});

describe('textoColores', () => {
  it('une los colores o dice "sin color"', () => {
    expect(textoColores('ROJO', 'NEGRO')).toBe('ROJO / NEGRO');
    expect(textoColores('ROJO', null)).toBe('ROJO');
    expect(textoColores(null, null)).toBe('sin color');
  });
});
