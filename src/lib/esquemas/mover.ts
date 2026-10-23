/**
 * Mover motos de ubicación (D40). La BD vuelve a validar todo en `mover_unidades`
 * (todas o ninguna; una moto vendida no se mueve).
 */
import { z } from 'zod';
import type { Rol } from '@/lib/roles';
import type { Database } from '@/types/database';

/** Igual que el tope de la RPC. */
export const MAX_MOVER = 500;

export const esquemaMover = z.object({
  vehicleIds: z
    .array(z.uuid('Unidad no válida.'))
    .min(1, 'Selecciona al menos una moto.')
    .max(MAX_MOVER, `Se pueden mover como máximo ${MAX_MOVER} motos a la vez.`)
    .transform((ids) => [...new Set(ids)]),
  ubicacionId: z.uuid('Elige una ubicación.'),
});

export type EntradaMover = z.input<typeof esquemaMover>;

/** Admin y técnico, salvo una moto vendida (la BD lo impone igual). */
export function puedeMoverUnidad(rol: Rol, estado: Database['public']['Enums']['vehicle_status']): boolean {
  return (rol === 'admin' || rol === 'tecnico') && estado !== 'vendido';
}

/** «1 moto movida a Showroom» / «3 motos movidas a …» / «Ya estaban en …». */
export function textoMovidas(movidas: number, ubicacion: string): string {
  if (movidas === 0) return `Ya estaban en ${ubicacion}`;
  return `${movidas} ${movidas === 1 ? 'moto movida' : 'motos movidas'} a ${ubicacion}`;
}
