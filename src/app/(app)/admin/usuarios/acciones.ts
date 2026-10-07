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

const esquemaRol = z.object({
  id: z.uuid(),
  rol: z.enum(['admin', 'tecnico', 'vendedor']).nullable(),
});

const esquemaActivo = z.object({ id: z.uuid(), activo: z.boolean() });

/** M1: asignar o quitar el rol (null = sin rol, pendiente de aprobación). */
export async function asignarRol(entrada: z.input<typeof esquemaRol>): Promise<Resultado> {
  await exigirRol('admin');
  const d = esquemaRol.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from('profiles').update({ rol: d.data.rol }).eq('id', d.data.id).select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  revalidatePath('/admin/usuarios');
  return exito(null);
}

/** M1: activar o desactivar una cuenta (una cuenta desactivada no ve nada). */
export async function cambiarActivo(entrada: z.input<typeof esquemaActivo>): Promise<Resultado> {
  await exigirRol('admin');
  const d = esquemaActivo.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ activo: d.data.activo })
    .eq('id', d.data.id)
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  revalidatePath('/admin/usuarios');
  return exito(null);
}
