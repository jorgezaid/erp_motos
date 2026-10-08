'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { exigirRol } from '@/lib/auth';
import {
  exito,
  fallo,
  falloValidacion,
  MENSAJE_SIN_FILAS,
  mensajeDeError,
  sinFilasAfectadas,
  type Resultado,
} from '@/lib/errores';
import { createClient } from '@/lib/supabase/server';

const esquemaReclamo = z.object({
  warrantyId: z.uuid('Garantía no válida.'),
  descripcion: z.string().trim().min(5, 'Describe el problema (mínimo 5 caracteres).').max(1000),
});

/** RN-19: la BD solo acepta reclamos de garantías vigentes y no anuladas. Cualquier rol con acceso. */
export async function registrarReclamo(entrada: z.input<typeof esquemaReclamo>): Promise<Resultado> {
  await exigirRol();
  const d = esquemaReclamo.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from('warranty_claims')
    .insert({ warranty_id: d.data.warrantyId, descripcion: d.data.descripcion });
  if (error) return fallo(mensajeDeError(error));
  revalidatePath('/garantias');
  return exito(null);
}

const esquemaAtencion = z.object({
  claimId: z.uuid('Reclamo no válido.'),
  estado: z.enum(['abierto', 'en_revision', 'aprobado', 'rechazado', 'cerrado']),
  diagnostico: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => v || null),
  costo: z
    .string()
    .trim()
    .transform((v) => v.replace(',', '.'))
    .refine((v) => v === '' || /^\d{1,10}(\.\d{1,2})?$/.test(v), 'Costo: número con hasta 2 decimales.')
    .transform((v) => (v === '' ? null : Number(v))),
});

export type EntradaAtencion = z.input<typeof esquemaAtencion>;

/** Seguimiento (admin y técnico): la BD valida las transiciones y exige diagnóstico (D27). */
export async function atenderReclamo(entrada: EntradaAtencion): Promise<Resultado> {
  await exigirRol('admin', 'tecnico');
  const d = esquemaAtencion.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('warranty_claims')
    .update({ estado: d.data.estado, diagnostico: d.data.diagnostico, costo_reparacion_pen: d.data.costo })
    .eq('id', d.data.claimId)
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  revalidatePath('/garantias');
  return exito(null);
}
