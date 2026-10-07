import { describe, expect, it } from 'vitest';
import { esquemaUbicacion } from './ubicacion';

describe('esquemaUbicacion (SPEC M2)', () => {
  it('normaliza espacios y la dirección vacía', () => {
    expect(esquemaUbicacion.parse({ nombre: '  Showroom Piérola ', tipo: 'showroom', direccion: '', activo: true })).toEqual({
      nombre: 'Showroom Piérola',
      tipo: 'showroom',
      direccion: null,
      activo: true,
    });
  });

  it('exige nombre y un tipo válido', () => {
    expect(esquemaUbicacion.safeParse({ nombre: ' ', tipo: 'almacen', direccion: '', activo: true }).success).toBe(false);
    expect(esquemaUbicacion.safeParse({ nombre: 'X', tipo: 'bodega', direccion: '', activo: true }).success).toBe(false);
  });
});
