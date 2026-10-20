/**
 * Colores de una unidad (D39). Se guardan en MAYÚSCULAS y sin espacios sobrantes, igual que
 * `public.normalizar_color` en la BD, que vuelve a validar todo en `editar_color_unidad`.
 */
import { z } from 'zod';
import type { Rol } from '@/lib/roles';
import type { Database } from '@/types/database';

export const MAX_COLOR = 30;

/** '  rojo   oscuro ' → 'ROJO OSCURO' (como `public.normalizar_color`). */
export function normalizarColor(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim().toUpperCase();
}

const color = (etiqueta: string) =>
  z
    .string()
    .transform(normalizarColor)
    .pipe(z.string().max(MAX_COLOR, `${etiqueta}: máximo ${MAX_COLOR} caracteres.`));

export const esquemaColor = z
  .object({
    primario: color('Color primario').pipe(z.string().min(1, 'Indica el color primario.')),
    secundario: color('Color secundario').transform((v) => (v === '' ? null : v)),
  })
  .refine((d) => d.primario !== d.secundario, {
    message: 'El color secundario debe ser distinto del primario.',
    path: ['secundario'],
  });

export type EntradaColor = z.input<typeof esquemaColor>;

/** Admin y técnico; una moto vendida solo la corrige el admin (la BD lo impone igual). */
export function puedeEditarColor(rol: Rol, estado: Database['public']['Enums']['vehicle_status']): boolean {
  return rol === 'admin' || (rol === 'tecnico' && estado !== 'vendido');
}

/** 'ROJO / NEGRO', 'ROJO' o 'sin color'. */
export function textoColores(primario: string | null | undefined, secundario: string | null | undefined): string {
  return [primario, secundario].filter(Boolean).join(' / ') || 'sin color';
}
