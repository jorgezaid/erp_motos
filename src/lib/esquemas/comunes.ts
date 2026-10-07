/**
 * Piezas zod para formularios. Los valores llegan como texto (inputs HTML) y se validan con la
 * misma escala que la columna de la BD (numeric(p, s)). Las comparaciones usan decimal.js.
 * La BD vuelve a validar todo (CHECK y triggers): esto es solo para la experiencia de usuario.
 */
import { z } from 'zod';
import { Decimal } from '@/lib/decimal';

/** Texto obligatorio, sin espacios sobrantes. */
export function textoRequerido(etiqueta: string, max = 200) {
  return z
    .string()
    .trim()
    .min(1, `${etiqueta}: es obligatorio.`)
    .max(max, `${etiqueta}: máximo ${max} caracteres.`);
}

/** Texto opcional: '' → null. */
export function textoOpcional(etiqueta: string, max = 500) {
  return z
    .string()
    .trim()
    .max(max, `${etiqueta}: máximo ${max} caracteres.`)
    .transform((v) => (v === '' ? null : v));
}

/** Entero ≥ min (como texto en el formulario). */
export function entero(etiqueta: string, { min = 0, max }: { min?: number; max?: number } = {}) {
  return z
    .string()
    .trim()
    .regex(/^\d+$/, `${etiqueta}: debe ser un número entero.`)
    .transform(Number)
    .refine((n) => n >= min, `${etiqueta}: debe ser al menos ${min}.`)
    .refine((n) => max === undefined || n <= max, `${etiqueta}: debe ser como máximo ${max}.`);
}

/**
 * Monto o medida con hasta `escala` decimales, ≥ 0 (o > 0 si `positivo`).
 * Sale como texto normalizado ('1234.50'), listo para la BD o para decimal.js.
 */
export function decimal(etiqueta: string, { escala = 2, positivo = false }: { escala?: number; positivo?: boolean } = {}) {
  const patron = new RegExp(`^\\d+(\\.\\d{1,${escala}})?$`);
  return z
    .string()
    .trim()
    .transform((v) => v.replace(',', '.'))
    .refine((v) => patron.test(v), `${etiqueta}: número mayor o igual a 0 con hasta ${escala} decimales.`)
    .refine((v) => !positivo || !patron.test(v) || new Decimal(v).gt(0), `${etiqueta}: debe ser mayor que 0.`);
}

/** Como `decimal`, pero '' → null (columnas opcionales). */
export function decimalOpcional(etiqueta: string, opciones: { escala?: number; positivo?: boolean } = {}) {
  return z.union([z.literal('').transform(() => null), decimal(etiqueta, opciones)]);
}

/** Fecha `aaaa-mm-dd` (input type=date) o vacío → null. */
export function fechaOpcional(etiqueta: string) {
  return z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), `${etiqueta}: fecha inválida.`)
    .transform((v) => (v === '' ? null : v));
}
