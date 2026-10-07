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
import { esquemaUbicacion, type EntradaUbicacion } from '@/lib/esquemas/ubicacion';
import { createClient } from '@/lib/supabase/server';

/** Crea (sin id) o actualiza una ubicación. */
export async function guardarUbicacion(id: string | null, entrada: EntradaUbicacion): Promise<Resultado> {
  await exigirRol('admin');
  if (id !== null && !z.uuid().safeParse(id).success) return fallo('Ubicación no válida.');
  const d = esquemaUbicacion.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  if (id === null) {
    const { error } = await supabase.from('locations').insert(d.data);
    if (error) return fallo(mensajeDeError(error));
  } else {
    const { data, error } = await supabase.from('locations').update(d.data).eq('id', id).select('id');
    if (error) return fallo(mensajeDeError(error));
    if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  }
  revalidatePath('/admin/ubicaciones');
  return exito(null);
}
