/** Proveedores (D41). Solo admin. */
import { z } from 'zod';
import { textoOpcional, textoRequerido } from './comunes';

export const esquemaProveedor = z.object({
  nombre: textoRequerido('Nombre', 120),
  ruc: textoOpcional('RUC', 11).refine((v) => v === null || /^\d{11}$/.test(v), 'RUC: 11 dígitos.'),
  telefono: textoOpcional('Teléfono', 30),
  activo: z.boolean(),
});

export type EntradaProveedor = z.input<typeof esquemaProveedor>;

export const PROVEEDOR_VACIO: EntradaProveedor = { nombre: '', ruc: '', telefono: '', activo: true };

/** Selector de proveedor de un lote: '' → sin proveedor. */
export const proveedorDelLote = z.union([z.literal('').transform(() => null), z.uuid('Elige un proveedor.')]);
