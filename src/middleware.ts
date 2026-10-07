import { NextResponse, type NextRequest } from 'next/server';
import { decidirRuta, type Rol } from '@/lib/roles';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request);

  let rol: Rol | null = null;
  if (user) {
    // current_app_role() devuelve null si el usuario no tiene rol o está desactivado
    const { data } = await supabase.rpc('current_app_role');
    rol = data ?? null;
  }

  const decision = decidirRuta(request.nextUrl.pathname, !!user, rol);
  if (decision.tipo === 'seguir') return response;

  const destino = new URL(decision.destino, request.url);
  const redireccion = NextResponse.redirect(destino);
  // Conserva las cookies de sesión refrescadas
  for (const cookie of response.cookies.getAll()) redireccion.cookies.set(cookie);
  return redireccion;
}

export const config = {
  // Todo menos los archivos estáticos e imágenes
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
