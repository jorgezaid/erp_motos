'use server';

import { revalidatePath } from 'next/cache';
import { exigirRol } from '@/lib/auth';
import { exito, fallo, falloValidacion, mensajeDeError, type Resultado } from '@/lib/errores';
import { esquemaNuevoLote, type EntradaNuevoLote } from '@/lib/esquemas/lote';
import { createClient } from '@/lib/supabase/server';

export async function crearLote(entrada: EntradaNuevoLote): Promise<Resultado<{ id: string }>> {
  await exigirRol('admin');
  const d = esquemaNuevoLote.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from('import_batches').insert(d.data).select('id').single();
  if (error) return fallo(mensajeDeError(error));
  revalidatePath('/lotes');
  return exito({ id: data.id });
}
