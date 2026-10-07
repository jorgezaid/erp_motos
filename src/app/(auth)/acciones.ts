'use server';

import { redirect } from 'next/navigation';
import type { z } from 'zod';
import { fallo, mensajeDeError, type Resultado } from '@/lib/errores';
import { destinoSeguro } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { esquemaLogin } from './esquemas';

export async function iniciarSesion(entrada: z.input<typeof esquemaLogin>): Promise<Resultado> {
  const datos = esquemaLogin.safeParse(entrada);
  if (!datos.success) return fallo('Revisa el email y la contraseña.');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: datos.data.email,
    password: datos.data.password,
  });
  if (error) return fallo(mensajeDeError(error));

  // Sin rol (o desactivada): directo a /pendiente, para que la URL del navegador sea la correcta
  const { data: rol } = await supabase.rpc('current_app_role');
  redirect(rol ? destinoSeguro(datos.data.next) : '/pendiente');
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
