/** Módulos del sidebar (SPEC M1: "el sidebar muestra solo los módulos permitidos para el rol"). */
import { puedeVer, type Rol } from '@/lib/roles';

export type Modulo = { href: string; etiqueta: string; grupo: 'operacion' | 'administracion' };

export const MODULOS: readonly Modulo[] = [
  { href: '/', etiqueta: 'Inicio', grupo: 'operacion' },
  { href: '/lotes', etiqueta: 'Lotes', grupo: 'operacion' },
  { href: '/inventario', etiqueta: 'Inventario', grupo: 'operacion' },
  { href: '/inventario/registro', etiqueta: 'Registro de unidades', grupo: 'operacion' },
  { href: '/taller', etiqueta: 'Taller', grupo: 'operacion' },
  { href: '/precios', etiqueta: 'Precios', grupo: 'operacion' },
  { href: '/ventas', etiqueta: 'Ventas', grupo: 'operacion' },
  { href: '/garantias', etiqueta: 'Garantías', grupo: 'operacion' },
  { href: '/auditoria', etiqueta: 'Auditoría', grupo: 'operacion' },
  { href: '/admin/usuarios', etiqueta: 'Usuarios', grupo: 'administracion' },
  { href: '/admin/modelos', etiqueta: 'Modelos', grupo: 'administracion' },
  { href: '/admin/ubicaciones', etiqueta: 'Ubicaciones', grupo: 'administracion' },
];

export function modulosPara(rol: Rol): Modulo[] {
  return MODULOS.filter((m) => puedeVer(m.href, rol));
}

/** El enlace activo es el de prefijo más largo que coincide con la ruta actual. */
export function moduloActivo(pathname: string, modulos: readonly Modulo[]): string | null {
  let activo: string | null = null;
  for (const m of modulos) {
    const coincide = m.href === '/' ? pathname === '/' : pathname === m.href || pathname.startsWith(`${m.href}/`);
    if (coincide && (!activo || m.href.length > activo.length)) activo = m.href;
  }
  return activo;
}
