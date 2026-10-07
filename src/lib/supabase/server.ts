import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { envSupabase } from './env';

/**
 * Cliente para Server Components, Server Actions y Route Handlers, con el JWT del usuario
 * (RLS siempre activo). Se crea uno por petición.
 */
export async function createClient() {
  const { url, anonKey } = envSupabase();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Llamado desde un Server Component: no puede escribir cookies. El middleware
          // ya refresca la sesión en cada petición, así que se puede ignorar.
        }
      },
    },
  });
}
