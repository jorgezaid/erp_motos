import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { envSupabase } from './env';

/** Cliente para Client Components: usa la sesión (cookies) del usuario en el navegador. */
export function createClient() {
  const { url, anonKey } = envSupabase();
  return createBrowserClient<Database>(url, anonKey);
}
