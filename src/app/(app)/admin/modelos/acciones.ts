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
import { esquemaModelo, type EntradaModelo, type Modelo } from '@/lib/esquemas/modelo';
import { createClient } from '@/lib/supabase/server';

/** numeric de la BD: los valores validados (≤ 12 dígitos) viajan exactos como number en el JSON. */
function aFila(m: Modelo) {
  return {
    ...m,
    volumen_cbm_unitario: Number(m.volumen_cbm_unitario),
    exw_usd_unitario: Number(m.exw_usd_unitario),
  };
}

export async function crearModelo(entrada: EntradaModelo): Promise<Resultado<{ id: string }>> {
  await exigirRol('admin');
  const d = esquemaModelo.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from('vehicle_models').insert(aFila(d.data)).select('id').single();
  if (error) return fallo(mensajeDeError(error));
  revalidatePath('/admin/modelos');
  return exito({ id: data.id });
}

export async function actualizarModelo(id: string, entrada: EntradaModelo): Promise<Resultado<{ id: string }>> {
  await exigirRol('admin');
  if (!z.uuid().safeParse(id).success) return fallo('Modelo no válido.');
  const d = esquemaModelo.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from('vehicle_models').update(aFila(d.data)).eq('id', id).select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  revalidatePath('/admin/modelos');
  revalidatePath(`/admin/modelos/${id}`);
  return exito({ id });
}

/** Solo se elimina un modelo que no esté en ningún packing list; si no, desactívalo. */
export async function eliminarModelo(id: string): Promise<Resultado> {
  await exigirRol('admin');
  if (!z.uuid().safeParse(id).success) return fallo('Modelo no válido.');

  const supabase = await createClient();
  const { data, error } = await supabase.from('vehicle_models').delete().eq('id', id).select('id');
  if (error) {
    if (error.code === '23503') {
      return fallo('El modelo ya figura en lotes o unidades: no se puede eliminar. Desactívalo para ocultarlo.');
    }
    return fallo(mensajeDeError(error));
  }
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  revalidatePath('/admin/modelos');
  return exito(null);
}
