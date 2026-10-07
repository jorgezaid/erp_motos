import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { puedeVer, type Rol } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';

export type Sesion = {
  userId: string;
  email: string;
  nombre: string;
  /** null = sin rol o cuenta desactivada (lo decide public.current_app_role()) */
  rol: Rol | null;
};

/** Usuario y rol de la petición actual (memoizado por petición). */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: perfil }, { data: rol }] = await Promise.all([
    supabase.from('profiles').select('nombre').eq('id', user.id).maybeSingle(),
    supabase.rpc('current_app_role'),
  ]);

  return { userId: user.id, email: user.email ?? '', nombre: perfil?.nombre ?? '', rol: rol ?? null };
});

/**
 * Defensa en profundidad en cada página y Server Action (además del middleware):
 * exige sesión y uno de los roles indicados.
 */
export async function exigirRol(...roles: Rol[]): Promise<Sesion & { rol: Rol }> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/login');
  if (!sesion.rol) redirect('/pendiente');
  if (roles.length > 0 && !roles.includes(sesion.rol)) redirect('/');
  return sesion as Sesion & { rol: Rol };
}

/** Igual que exigirRol, pero a partir de la ruta (usa la misma tabla que el middleware). */
export async function exigirAccesoARuta(pathname: string): Promise<Sesion & { rol: Rol }> {
  const sesion = await exigirRol();
  if (!puedeVer(pathname, sesion.rol)) redirect('/');
  return sesion;
}
