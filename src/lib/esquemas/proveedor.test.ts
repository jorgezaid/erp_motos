import { describe, expect, it } from 'vitest';
import { esquemaProveedor, proveedorDelLote } from './proveedor';

describe('esquemaProveedor (D41)', () => {
  it('D41: RUC y teléfono opcionales; RUC de 11 dígitos', () => {
    expect(esquemaProveedor.parse({ nombre: ' Luna Importaciones ', ruc: '', telefono: '', activo: true })).toEqual({
      nombre: 'Luna Importaciones',
      ruc: null,
      telefono: null,
      activo: true,
    });
    expect(esquemaProveedor.safeParse({ nombre: 'Luna', ruc: '20123456789', telefono: '987654321', activo: true }).success).toBe(true);
    expect(esquemaProveedor.safeParse({ nombre: 'Luna', ruc: '2012345678X', telefono: '', activo: true }).success).toBe(false);
    expect(esquemaProveedor.safeParse({ nombre: ' ', ruc: '', telefono: '', activo: true }).success).toBe(false);
  });

  it('D41: el proveedor de un lote es un id o vacío', () => {
    expect(proveedorDelLote.parse('')).toBeNull();
    expect(proveedorDelLote.safeParse('x').success).toBe(false);
  });
});
