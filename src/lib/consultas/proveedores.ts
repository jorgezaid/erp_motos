import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type OpcionProveedor = { valor: string; etiqueta: string };

/**
 * Proveedores para un selector (D41, solo admin por RLS): los activos y, si se indica, el
 * actual aunque esté desactivado (para no perderlo al editar).
 */
export async function opcionesProveedores(actual?: string | null): Promise<OpcionProveedor[]> {
  const supabase = await createClient();
  let consulta = supabase.from('proveedores').select('id, nombre, ruc').order('nombre');
  consulta = actual ? consulta.or(`activo.eq.true,id.eq.${actual}`) : consulta.eq('activo', true);
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return data.map((p) => ({ valor: p.id, etiqueta: p.ruc ? `${p.nombre} · RUC ${p.ruc}` : p.nombre }));
}

/** Ids de los proveedores cuyo nombre o RUC contiene `q` (para buscar lotes por proveedor). */
export async function proveedoresQueCoinciden(q: string): Promise<string[]> {
  const limpio = q.replace(/[,()*:"\\%_]/g, ' ').trim();
  if (!limpio) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from('proveedores').select('id').or(`nombre.ilike.*${limpio}*,ruc.ilike.*${limpio}*`);
  if (error) throw new Error(error.message);
  return data.map((p) => p.id);
}
