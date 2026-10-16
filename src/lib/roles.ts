/**
 * Acceso a las pantallas por rol (SPEC §3 y §10). Es solo experiencia de usuario: la seguridad
 * real la aplica el RLS de la BD. Se usa en el middleware, en el sidebar y en las páginas.
 */
import type { Database } from '@/types/database';

export type Rol = Database['public']['Enums']['app_role'];

export const ROLES: readonly Rol[] = ['admin', 'tecnico', 'vendedor'];

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  tecnico: 'Técnico',
  vendedor: 'Vendedor',
};

const TODOS: readonly Rol[] = ROLES;

/** Prefijo de ruta → roles que pueden verla. Gana el prefijo más largo que coincida. */
const ACCESO: ReadonlyArray<readonly [string, readonly Rol[]]> = [
  ['/', TODOS],
  ['/lotes', ['admin']],
  ['/inventario', TODOS],
  ['/inventario/registro', ['admin', 'tecnico']],
  ['/taller', ['admin', 'tecnico']],
  ['/precios', ['admin', 'vendedor']],
  ['/ventas', ['admin', 'vendedor']],
  ['/garantias', TODOS],
  ['/auditoria', ['admin']],
  ['/gastos', ['admin']],
  ['/admin', ['admin']],
];

/** Rutas que no exigen sesión. */
const PUBLICAS = ['/login'];
const PENDIENTE = '/pendiente';

function coincide(pathname: string, prefijo: string): boolean {
  return prefijo === '/' ? true : pathname === prefijo || pathname.startsWith(`${prefijo}/`);
}

export function rolesDeRuta(pathname: string): readonly Rol[] {
  let mejor: readonly [string, readonly Rol[]] = ['/', TODOS];
  for (const regla of ACCESO) {
    if (coincide(pathname, regla[0]) && regla[0].length >= mejor[0].length) mejor = regla;
  }
  return mejor[1];
}

export function puedeVer(pathname: string, rol: Rol | null | undefined): boolean {
  return !!rol && rolesDeRuta(pathname).includes(rol);
}

export type Decision = { tipo: 'seguir' } | { tipo: 'redirigir'; destino: string };

/**
 * Qué hacer con una petición según la sesión (SPEC M1):
 * sin sesión → /login · sin rol (o cuenta desactivada) → /pendiente · sin permiso → inicio.
 */
export function decidirRuta(pathname: string, autenticado: boolean, rol: Rol | null): Decision {
  const esPublica = PUBLICAS.some((p) => coincide(pathname, p));

  if (!autenticado) {
    if (esPublica) return { tipo: 'seguir' };
    const next = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return { tipo: 'redirigir', destino: `/login${next}` };
  }
  if (esPublica) return { tipo: 'redirigir', destino: rol ? '/' : PENDIENTE };
  if (!rol) return pathname === PENDIENTE ? { tipo: 'seguir' } : { tipo: 'redirigir', destino: PENDIENTE };
  if (pathname === PENDIENTE) return { tipo: 'redirigir', destino: '/' };
  return puedeVer(pathname, rol) ? { tipo: 'seguir' } : { tipo: 'redirigir', destino: '/' };
}

/** Solo rutas internas (evita redirecciones abiertas con ?next=https://…). */
export function destinoSeguro(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  return next;
}
