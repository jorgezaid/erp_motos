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
import { normalizarSerial } from '@/lib/registro';
import { createClient } from '@/lib/supabase/server';

const uuid = z.uuid('Unidad no válida.');

function revalidar(vehicleId: string) {
  revalidatePath(`/taller/${vehicleId}`);
  revalidatePath('/taller');
  revalidatePath('/inventario');
}

const esquemaBaterias = z.object({
  vehicleId: uuid,
  seriales: z
    .array(
      z.object({
        posicion: z.number().int().min(1).max(6),
        serial: z.string().transform(normalizarSerial).pipe(z.string().min(1).max(40, 'Serial: máximo 40 caracteres.')),
      }),
    )
    .min(1, 'Escanea al menos un serial.')
    .max(6),
});

/** RN-02: la BD impide registrar más seriales que los que exige el voltaje; RN-03: únicos. */
export async function guardarBaterias(entrada: z.input<typeof esquemaBaterias>): Promise<Resultado<{ guardadas: number }>> {
  await exigirRol('admin', 'tecnico');
  const d = esquemaBaterias.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);
  const repetido = d.data.seriales.find((s, i) => d.data.seriales.findIndex((x) => x.serial === s.serial) !== i);
  if (repetido) return fallo(`El serial ${repetido.serial} está repetido.`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicle_batteries')
    .insert(d.data.seriales.map((s) => ({ vehicle_id: d.data.vehicleId, posicion: s.posicion, serial: s.serial })))
    .select('id');
  if (error) {
    if (error.code === '23505' && /posicion/.test(error.message)) return fallo('Esa posición ya tiene una batería registrada.');
    return fallo(mensajeDeError(error));
  }
  revalidar(d.data.vehicleId);
  return exito({ guardadas: data.length });
}

/** Corrige un serial mal escaneado. */
export async function quitarBateria(vehicleId: string, bateriaId: string): Promise<Resultado> {
  await exigirRol('admin', 'tecnico');
  if (!uuid.safeParse(vehicleId).success || !uuid.safeParse(bateriaId).success) return fallo('Batería no válida.');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicle_batteries')
    .delete()
    .eq('id', bateriaId)
    .eq('vehicle_id', vehicleId)
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  revalidar(vehicleId);
  return exito(null);
}

const esquemaInspeccion = z.object({
  vehicleId: uuid,
  baterias_contadas: z.number('Baterías contadas: número entero.').int('Baterías contadas: número entero.').min(0).max(6),
  vin_verificado: z.boolean(),
  motor_verificado: z.boolean(),
  voltaje_medido: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{1,3}(\.\d{1,2})?$/.test(v), 'Voltaje medido: número con hasta 2 decimales.')
    .transform((v) => (v === '' ? null : Number(v))),
  frenos: z.boolean(),
  luces: z.boolean(),
  claxon: z.boolean(),
  observaciones: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => v || null),
});

export type EntradaInspeccion = z.input<typeof esquemaInspeccion>;

/**
 * RN-11: la inspección se aprueba sola si cuadran baterías, VIN y motor (columna generada);
 * `baterias_esperadas` la fija el sistema. Las inspecciones no se editan: se registra otra.
 */
export async function registrarInspeccion(entrada: EntradaInspeccion): Promise<Resultado<{ aprobada: boolean }>> {
  await exigirRol('admin', 'tecnico');
  const d = esquemaInspeccion.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);
  const i = d.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('technical_inspections')
    .insert({
      vehicle_id: i.vehicleId,
      baterias_contadas: i.baterias_contadas,
      baterias_esperadas: 0, // lo reemplaza el trigger inspection_defaults con el valor del modelo
      vin_verificado: i.vin_verificado,
      motor_verificado: i.motor_verificado,
      voltaje_medido: i.voltaje_medido,
      checklist: { frenos: i.frenos, luces: i.luces, claxon: i.claxon },
      observaciones: i.observaciones,
    })
    .select('aprobada')
    .single();
  if (error) return fallo(mensajeDeError(error));
  revalidar(i.vehicleId);
  return exito({ aprobada: !!data.aprobada });
}

/** RN-10: en_ensamble → listo_en_tienda con su ubicación; la BD valida baterías, inspección y ubicación. */
export async function pasarATienda(vehicleId: string, locationId: string): Promise<Resultado> {
  await exigirRol('admin', 'tecnico');
  if (!uuid.safeParse(vehicleId).success) return fallo('Unidad no válida.');
  if (!uuid.safeParse(locationId).success) return fallo('Elige la ubicación en tienda.');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicle_inventory')
    .update({ estado: 'listo_en_tienda', location_id: locationId })
    .eq('id', vehicleId)
    .eq('estado', 'en_ensamble')
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo('La unidad ya no está en ensamble o no tienes permiso para moverla.');
  revalidar(vehicleId);
  return exito(null);
}
