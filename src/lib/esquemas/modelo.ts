/** Catálogo de modelos (SPEC M2). */
import { z } from 'zod';
import { decimal, entero, textoOpcional, textoRequerido } from './comunes';

export const VOLTAJES = [48, 60, 72] as const;
export type Voltaje = (typeof VOLTAJES)[number];

/** RN-01: 48V → 4, 60V → 5, 72V → 6 baterías de 12V (en la BD es la columna generada voltaje / 12). */
export function bateriasPorVoltaje(voltaje: number): number | null {
  return (VOLTAJES as readonly number[]).includes(voltaje) ? voltaje / 12 : null;
}

export function textoBaterias(voltaje: number): string {
  const n = bateriasPorVoltaje(voltaje);
  return n === null ? 'Voltaje no válido: solo 48V, 60V o 72V' : `${n} baterías de 12V`;
}

export const esquemaModelo = z.object({
  codigo_modelo: textoRequerido('Código de modelo', 40).transform((v) => v.toUpperCase()),
  nombre_comercial: textoOpcional('Nombre comercial', 120),
  categoria: z.enum(['bicimoto', 'trimoto_pasajeros', 'trimoto_carga'], 'Elige la categoría.'),
  voltaje_sistema: z
    .string()
    .refine((v) => (VOLTAJES as readonly number[]).includes(Number(v)), 'El voltaje debe ser 48V, 60V o 72V.')
    .transform((v) => Number(v) as Voltaje),
  amperaje_bateria_ah: entero('Amperaje (Ah)', { min: 1 }),
  potencia_motor_watts: entero('Potencia (W)', { min: 1 }),
  volumen_cbm_unitario: decimal('Volumen (CBM)', { escala: 4, positivo: true }),
  exw_usd_unitario: decimal('EXW unitario (US$)', { escala: 2 }),
  garantia_meses: entero('Garantía general (meses)', { max: 120 }),
  garantia_baterias_meses: entero('Garantía de baterías (meses)', { max: 120 }),
  activo: z.boolean(),
});

export type EntradaModelo = z.input<typeof esquemaModelo>;
export type Modelo = z.output<typeof esquemaModelo>;

/** Valores por defecto del formulario (garantías 12 y 6 meses: valores de la BD, ver PROGRESS → Preguntas). */
export const MODELO_VACIO: EntradaModelo = {
  codigo_modelo: '',
  nombre_comercial: '',
  categoria: 'bicimoto',
  voltaje_sistema: '48',
  amperaje_bateria_ah: '',
  potencia_motor_watts: '',
  volumen_cbm_unitario: '',
  exw_usd_unitario: '',
  garantia_meses: '12',
  garantia_baterias_meses: '6',
  activo: true,
};
