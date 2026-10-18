/** Precios (SPEC M5): margen global como porcentaje y precio manual por lote, modelo y escala. */
import { z } from 'zod';
import { Decimal } from '@/lib/decimal';

/** "45" o "45.5" (%) → "0.4500" (fracción de price_margins.margen_objetivo, numeric(5,4)). */
export const porcentajeMargen = z
  .string()
  .trim()
  .transform((v) => v.replace(',', '.'))
  .refine((v) => /^\d{1,2}(\.\d{1,2})?$/.test(v), 'Margen: porcentaje entre 0 y 99.99, con hasta 2 decimales.')
  .transform((v) => new Decimal(v).div(100).toFixed(4));

export const esquemaMargenes = z.object({
  unidad_x1: porcentajeMargen,
  mayorista_x3: porcentajeMargen,
  distribuidor_x6: porcentajeMargen,
});

export type EntradaMargenes = z.input<typeof esquemaMargenes>;

/** RN-25: descuento máximo del vendedor por moto, "10" (%) → "0.1000" (configuracion_ventas). */
export const esquemaDescuentoMaximo = z.object({
  porcentaje: z
    .string()
    .trim()
    .transform((v) => v.replace(',', '.'))
    .refine((v) => /^\d{1,2}(\.\d{1,2})?$/.test(v), 'Descuento máximo: porcentaje entre 0 y 99.99, con hasta 2 decimales.')
    .transform((v) => new Decimal(v).div(100).toFixed(4)),
});

export type EntradaDescuentoMaximo = z.input<typeof esquemaDescuentoMaximo>;

/** Precio manual: vacío = volver al sugerido. */
export const precioManual = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, '').replace(',', '.'))
  .refine((v) => v === '' || /^\d{1,12}(\.\d{1,2})?$/.test(v), 'Precio: número mayor que 0 con hasta 2 decimales.')
  .refine((v) => v === '' || new Decimal(v).gt(0), 'Precio: debe ser mayor que 0.')
  .transform((v) => (v === '' ? null : new Decimal(v).toFixed(2)));

/** 0.45 → "45"; 0.355 → "35.5" (para mostrar el margen en el formulario). */
export function aPorcentaje(fraccion: number | string): string {
  return new Decimal(fraccion).times(100).toDecimalPlaces(2).toString();
}
