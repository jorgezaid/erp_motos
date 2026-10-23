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
import { esquemaProveedor, type EntradaProveedor } from '@/lib/esquemas/proveedor';
import { createClient } from '@/lib/supabase/server';

/** Crea (sin id) o actualiza un proveedor (D41). No se eliminan: los lotes los referencian. */
export async function guardarProveedor(id: string | null, entrada: EntradaProveedor): Promise<Resultado> {
  await exigirRol('admin');
  if (id !== null && !z.uuid().safeParse(id).success) return fallo('Proveedor no válido.');
  const d = esquemaProveedor.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  if (id === null) {
    const { error } = await supabase.from('proveedores').insert(d.data);
    if (error) return fallo(mensajeDeError(error));
  } else {
    const { data, error } = await supabase.from('proveedores').update(d.data).eq('id', id).select('id');
    if (error) return fallo(mensajeDeError(error));
    if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  }
  revalidatePath('/admin/proveedores');
  revalidatePath('/lotes', 'layout');
  return exito(null);
}
