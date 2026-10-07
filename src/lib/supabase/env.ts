/**
 * Variables públicas de Supabase. Solo la URL y la clave anónima: la app nunca usa la
 * service_role key (toda operación va con el JWT del usuario y queda sujeta a RLS).
 *
 * Next.js reemplaza `process.env.NEXT_PUBLIC_*` en tiempo de compilación solo si se escriben
 * literalmente, por eso se leen aquí y no con un acceso dinámico.
 */
export type EnvSupabase = { url: string; anonKey: string };

export function validarEnvSupabase(url: string | undefined, anonKey: string | undefined): EnvSupabase {
  if (!url || !anonKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. En local ejecuta `pnpm env:local` ' +
        '(con `supabase start` corriendo) para crear .env.local.',
    );
  }
  try {
    new URL(url);
  } catch {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL no es una URL válida: ${url}`);
  }
  return { url, anonKey };
}

export function envSupabase(): EnvSupabase {
  return validarEnvSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
