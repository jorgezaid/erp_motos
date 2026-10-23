'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { exigirRol } from '@/lib/auth';
import { esquemaColor, type EntradaColor } from '@/lib/esquemas/color';
import { esquemaMover, type EntradaMover } from '@/lib/esquemas/mover';
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

/**
 * D40: cambia solo la ubicación de una o varias motos con la RPC `mover_unidades` (admin y
 * técnico; todas o ninguna; una vendida no se mueve). Devuelve cuántas cambiaron.
 */
export async function moverUnidades(entrada: EntradaMover): Promise<Resultado<{ movidas: number }>> {
  await exigirRol('admin', 'tecnico');
  const d = esquemaMover.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('mover_unidades', {
    p_vehicle_ids: d.data.vehicleIds,
    p_location_id: d.data.ubicacionId,
  });
  if (error) return fallo(mensajeDeError(error));

  revalidatePath('/inventario');
  revalidatePath('/taller', 'layout');
  return exito({ movidas: data });
}
