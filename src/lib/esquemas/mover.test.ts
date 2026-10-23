import { describe, expect, it } from 'vitest';
import { esquemaMover, MAX_MOVER, puedeMoverUnidad, textoMovidas } from './mover';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';

describe('esquemaMover (D40)', () => {
  it('D40: quita las motos repetidas', () => {
    expect(esquemaMover.parse({ vehicleIds: [A, B, A], ubicacionId: B })).toEqual({ vehicleIds: [A, B], ubicacionId: B });
  });

  it('D40: exige al menos una moto, como máximo el tope y una ubicación', () => {
    expect(esquemaMover.safeParse({ vehicleIds: [], ubicacionId: B }).success).toBe(false);
    expect(esquemaMover.safeParse({ vehicleIds: Array(MAX_MOVER + 1).fill(A), ubicacionId: B }).success).toBe(false);
    expect(esquemaMover.safeParse({ vehicleIds: [A], ubicacionId: '' }).success).toBe(false);
    expect(esquemaMover.safeParse({ vehicleIds: ['x'], ubicacionId: B }).success).toBe(false);
  });
});

describe('puedeMoverUnidad (D40)', () => {
  it('D40: admin y técnico, nunca una vendida; el vendedor no mueve', () => {
    expect(puedeMoverUnidad('admin', 'listo_en_tienda')).toBe(true);
    expect(puedeMoverUnidad('tecnico', 'en_caja')).toBe(true);
    expect(puedeMoverUnidad('tecnico', 'reservado')).toBe(true);
    expect(puedeMoverUnidad('admin', 'vendido')).toBe(false);
    expect(puedeMoverUnidad('vendedor', 'en_caja')).toBe(false);
  });
});

describe('textoMovidas', () => {
  it('singular, plural y sin cambios', () => {
    expect(textoMovidas(1, 'Showroom')).toBe('1 moto movida a Showroom');
    expect(textoMovidas(10, 'Showroom')).toBe('10 motos movidas a Showroom');
    expect(textoMovidas(0, 'Showroom')).toBe('Ya estaban en Showroom');
  });
});
