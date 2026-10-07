'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { exigirRol } from '@/lib/auth';
import { exito, fallo, mensajeDeError, sinFilasAfectadas, type Resultado } from '@/lib/errores';
import { createClient } from '@/lib/supabase/server';

/** Saca la unidad de la caja: en_caja → en_ensamble (SPEC §9). */
export async function iniciarEnsamble(vehicleId: string): Promise<Resultado> {
  await exigirRol('admin', 'tecnico');
  if (!z.uuid().safeParse(vehicleId).success) return fallo('Unidad no válida.');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicle_inventory')
    .update({ estado: 'en_ensamble' })
    .eq('id', vehicleId)
    .eq('estado', 'en_caja')
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo('La unidad ya no está en caja (otro técnico pudo haberla movido).');
  revalidatePath('/taller', 'layout');
  return exito(null);
}
