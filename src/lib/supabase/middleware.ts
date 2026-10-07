import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { envSupabase } from './env';

/**
 * Refresca la sesión de Supabase en cada petición y devuelve la respuesta con las cookies
 * actualizadas, el cliente y el usuario autenticado (o null).
 * No se debe ejecutar código entre createServerClient y getUser (recomendación de @supabase/ssr).
 */
export async function updateSession(request: NextRequest) {
  const { url, anonKey } = envSupabase();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, supabase, user };
}
