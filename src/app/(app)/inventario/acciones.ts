'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { exigirRol } from '@/lib/auth';
import { esquemaColor, type EntradaColor } from '@/lib/esquemas/color';
import { exito, fallo, falloValidacion, mensajeDeError, type Resultado } from '@/lib/errores';
import { createClient } from '@/lib/supabase/server';

/**
 * D39: cambia solo los colores con la RPC `editar_color_unidad` (admin y técnico; una moto
 * vendida solo el admin). Lo usan /inventario y /taller/[id].
 */
export async function editarColor(
  vehicleId: string,
  entrada: EntradaColor,
): Promise<Resultado<{ primario: string; secundario: string | null }>> {
  await exigirRol('admin', 'tecnico');
  if (!z.uuid().safeParse(vehicleId).success) return fallo('Unidad no válida.');
  const d = esquemaColor.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc('editar_color_unidad', {
    p_vehicle_id: vehicleId,
    p_primario: d.data.primario,
    p_secundario: d.data.secundario ?? '',
  });
  if (error) return fallo(mensajeDeError(error));

  revalidatePath('/inventario');
  revalidatePath('/taller');
  revalidatePath(`/taller/${vehicleId}`);
  return exito(d.data);
}
