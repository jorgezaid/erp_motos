/**
 * Escalas de venta activas (D31). La BD es la autoridad: el trigger `guard_escala_activa`
 * rechaza crear, cambiar o confirmar una orden con una escala inactiva. Esto solo decide qué
 * ofrecer en la UI.
 */
import { z } from 'zod';
import type { TipoVenta } from '@/lib/ventas';

export const TIPOS_VENTA = ['unidad_x1', 'mayorista_x3', 'distribuidor_x6'] as const satisfies readonly TipoVenta[];

/** Fila de `public.price_margins` (sin el margen: lo puede leer cualquier rol con acceso a ventas). */
export type Escala = { tipo_venta: TipoVenta; cantidad_minima: number; activo: boolean };

/** Escalas en el orden x1, x3, x6 (las que falten en la BD se omiten). */
export function ordenarEscalas<E extends { tipo_venta: TipoVenta }>(escalas: readonly E[]): E[] {
  return [...escalas].sort((a, b) => TIPOS_VENTA.indexOf(a.tipo_venta) - TIPOS_VENTA.indexOf(b.tipo_venta));
}

/** Tipos de venta activos, en el orden x1, x3, x6. */
export function tiposActivos(escalas: readonly Escala[]): TipoVenta[] {
  return ordenarEscalas(escalas)
    .filter((e) => e.activo)
    .map((e) => e.tipo_venta);
}

/** Mínimo de unidades por tipo de venta (1 si falta). */
export function minimosPorTipo(escalas: readonly Escala[]): Record<TipoVenta, number> {
  const m: Record<TipoVenta, number> = { unidad_x1: 1, mayorista_x3: 1, distribuidor_x6: 1 };
  for (const e of escalas) m[e.tipo_venta] = e.cantidad_minima;
  return m;
}

/**
 * Se muestra el selector de escala si hay más de una activa, o si la orden quedó con una escala
 * que se desactivó después (hay que poder cambiarla para confirmar).
 */
export function mostrarSelectorEscala(activas: readonly TipoVenta[], actual?: TipoVenta): boolean {
  return activas.length > 1 || (actual !== undefined && !activas.includes(actual));
}

export const esquemaEscalaActiva = z.object({
  tipoVenta: z.enum(TIPOS_VENTA, 'Tipo de venta no válido.'),
  activo: z.boolean(),
});
