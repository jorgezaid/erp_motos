import 'server-only';
import { ETIQUETA_ROL } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import type { ColumnaCsv } from '@/lib/tabla';
import { formatFecha } from '@/lib/format';
import type { Database } from '@/types/database';

export type Usuario = Database['public']['Functions']['listar_usuarios']['Returns'][number];

export const ESTADOS_USUARIO = [
  { valor: 'pendiente', etiqueta: 'Sin rol (pendiente)' },
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'inactivo', etiqueta: 'Desactivado' },
];

/** La lista es corta (personal de la empresa): se filtra en el servidor tras la RPC. */
export async function consultarUsuarios({ q, estado }: { q: string; estado: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('listar_usuarios');
  if (error) throw new Error(error.message);
  const texto = q.toLowerCase();
  return data.filter(
    (u) =>
      (!texto || u.email.toLowerCase().includes(texto) || u.nombre.toLowerCase().includes(texto)) &&
      (!estado ||
        (estado === 'pendiente' && !u.rol) ||
        (estado === 'activo' && u.activo && !!u.rol) ||
        (estado === 'inactivo' && !u.activo)),
  );
}

export const COLUMNAS_CSV: ColumnaCsv<Usuario>[] = [
  { encabezado: 'Nombre', valor: (u) => u.nombre },
  { encabezado: 'Email', valor: (u) => u.email },
  { encabezado: 'Rol', valor: (u) => (u.rol ? ETIQUETA_ROL[u.rol] : 'Sin rol') },
  { encabezado: 'Activo', valor: (u) => (u.activo ? 'Sí' : 'No') },
  { encabezado: 'Alta', valor: (u) => formatFecha(u.created_at) },
];
