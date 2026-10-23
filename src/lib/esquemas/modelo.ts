/** Catálogo de modelos (SPEC M2). */
import { z } from 'zod';
import { decimalOpcional, entero, textoOpcional, textoRequerido } from './comunes';

export const VOLTAJES = [48, 60, 72] as const;
export type Voltaje = (typeof VOLTAJES)[number];

/** RN-01: 48V → 4, 60V → 5, 72V → 6 baterías de 12V (en la BD la calcula un trigger; con litio, D41, es baterias_litio). */
export function bateriasPorVoltaje(voltaje: number): number | null {
  return (VOLTAJES as readonly number[]).includes(voltaje) ? voltaje / 12 : null;
}

export function textoBaterias(voltaje: number): string {
  const n = bateriasPorVoltaje(voltaje);
  return n === null ? 'Voltaje no válido: solo 48V, 60V o 72V' : `${n} baterías de 12V`;
}

export const TIPOS_BATERIA = ['plomo_12v', 'litio'] as const;
export const MAX_BATERIAS_LITIO = 6;

export const esquemaModelo = z
  .object({
  codigo_modelo: textoRequerido('Código de modelo', 40).transform((v) => v.toUpperCase()),
  nombre_comercial: textoOpcional('Nombre comercial', 120),
  categoria: z.enum(['bicimoto', 'trimoto_pasajeros', 'trimoto_carga'], 'Elige la categoría.'),
  voltaje_sistema: z
    .string()
    .refine((v) => (VOLTAJES as readonly number[]).includes(Number(v)), 'El voltaje debe ser 48V, 60V o 72V.')
    .transform((v) => Number(v) as Voltaje),
  amperaje_bateria_ah: entero('Amperaje (Ah)', { min: 1 }),
  potencia_motor_watts: entero('Potencia (W)', { min: 1 }),
  // D41: opcionales (compras locales); la línea de un lote de importación los exige
  volumen_cbm_unitario: decimalOpcional('Volumen (CBM)', { escala: 4, positivo: true }),
  exw_usd_unitario: decimalOpcional('EXW unitario (US$)', { escala: 2 }),
  garantia_meses: entero('Garantía general (meses)', { max: 120 }),
  garantia_baterias_meses: entero('Garantía de baterías (meses)', { max: 120 }),
  tipo_bateria: z.enum(TIPOS_BATERIA, 'Elige el tipo de batería.'),
  baterias_litio: z.string().trim(),
  tiene_techo: z.boolean(),
  activo: z.boolean(),
})
  // Litio: su cantidad (1 a 6); plomo: se deriva del voltaje y no se guarda
  .transform((m, ctx) => {
    if (m.tipo_bateria === 'plomo_12v') return { ...m, baterias_litio: null };
    const n = /^\d+$/.test(m.baterias_litio) ? Number(m.baterias_litio) : NaN;
    if (!(n >= 1 && n <= MAX_BATERIAS_LITIO)) {
      ctx.addIssue({
        code: 'custom',
        message: `Baterías de litio: entre 1 y ${MAX_BATERIAS_LITIO}.`,
        path: ['baterias_litio'],
      });
      return z.NEVER;
    }
    return { ...m, baterias_litio: n };
  });

/** «5 baterías de 12V» o «1 batería de litio» (vista previa del formulario). */
export function textoBateriasModelo(voltaje: number, tipo: (typeof TIPOS_BATERIA)[number], litio: string): string {
  if (tipo === 'plomo_12v') return textoBaterias(voltaje);
  const n = Number(litio);
  if (!/^\d+$/.test(litio) || n < 1 || n > MAX_BATERIAS_LITIO) return `Indica de 1 a ${MAX_BATERIAS_LITIO} baterías de litio`;
  return `${n} ${n === 1 ? 'batería' : 'baterías'} de litio`;
}

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
  tipo_bateria: 'plomo_12v',
  baterias_litio: '',
  tiene_techo: false,
  activo: true,
};
