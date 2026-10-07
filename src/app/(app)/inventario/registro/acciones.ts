'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { exigirRol } from '@/lib/auth';
import { exito, fallo, falloValidacion, mensajeDeError, type Resultado } from '@/lib/errores';
import { MAX_FILAS_REGISTRO, normalizarSerial, validarFilas } from '@/lib/registro';
import { createClient } from '@/lib/supabase/server';

const color = z
  .string()
  .trim()
  .max(40, 'Color: máximo 40 caracteres.')
  .nullable()
  .transform((v) => v || null);

const esquema = z.object({
  batchId: z.uuid('Elige el lote y modelo.'),
  modelId: z.uuid('Elige el lote y modelo.'),
  locationId: z.uuid().nullable(),
  filas: z
    .array(
      z.object({
        vin: z.string().transform(normalizarSerial).pipe(z.string().min(1, 'Falta el VIN.').max(40)),
        motor: z.string().transform(normalizarSerial).pipe(z.string().min(1, 'Falta el número de motor.').max(40)),
        color1: color,
        color2: color,
      }),
    )
    .min(1, 'No hay unidades para registrar.')
    .max(MAX_FILAS_REGISTRO, `Máximo ${MAX_FILAS_REGISTRO} unidades por registro.`),
});

/**
 * Registra las unidades en un solo INSERT (todo o nada). La BD aplica RN-03 (únicos y en
 * mayúsculas) y RN-04 (no más que el packing list); sus mensajes se muestran tal cual.
 */
export async function registrarUnidades(entrada: z.input<typeof esquema>): Promise<Resultado<{ registradas: number }>> {
  await exigirRol('admin', 'tecnico');
  const d = esquema.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);
  const errores = validarFilas(d.data.filas);
  if (errores[0]) return fallo(`Fila ${errores[0].linea}: ${errores[0].mensaje}`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicle_inventory')
    .insert(
      d.data.filas.map((f) => ({
        batch_id: d.data.batchId,
        model_id: d.data.modelId,
        vin_chasis: f.vin,
        nro_motor: f.motor,
        color_primario: f.color1,
        color_secundario: f.color2,
        location_id: d.data.locationId,
        estado: 'en_caja' as const,
      })),
    )
    .select('id');
  if (error) return fallo(mensajeDeError(error));

  revalidatePath('/inventario', 'layout');
  revalidatePath('/taller');
  return exito({ registradas: data.length });
}
