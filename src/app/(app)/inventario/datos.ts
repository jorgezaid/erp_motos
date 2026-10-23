import 'server-only';
import type { Rol } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';

type SP = Record<string, string | string[] | undefined>;

const texto = (v: string | string[] | undefined) => (typeof v === 'string' ? v.trim().slice(0, 60) : '');

/**
 * Filtros extra de /inventario (SPEC M4): modelo, ubicación, color, baterías sin serial real (D37)
 * y origen (D41). El proveedor solo se lee para el admin (D41: el vendedor y el técnico no lo ven).
 */
export function leerFiltrosInventario(sp: SP, rol: Rol) {
  return {
    modelo: texto(sp.modelo),
    ubicacion: texto(sp.ubicacion),
    color: texto(sp.color),
    baterias: texto(sp.baterias),
    origen: texto(sp.origen),
    proveedor: rol === 'admin' ? texto(sp.proveedor) : '',
  };
}

/** Colores ya usados (primario o secundario), ordenados: filtro y sugerencias del editor (D39). */
export async function coloresExistentes(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('vehicle_inventory').select('color_primario, color_secundario').limit(2000);
  const colores = new Set<string>();
  for (const c of data ?? []) {
    if (c.color_primario) colores.add(c.color_primario);
    if (c.color_secundario) colores.add(c.color_secundario);
  }
  return [...colores].sort((a, b) => a.localeCompare(b, 'es'));
}

/** D40: destinos para mover motos (ubicaciones activas de cualquier tipo). */
export async function ubicacionesActivas(): Promise<{ id: string; nombre: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('locations').select('id, nombre').eq('activo', true).order('nombre');
  if (error) throw new Error(error.message);
  return data;
}

/** Opciones de los selects de filtro (catálogos pequeños). */
export async function opcionesFiltroInventario() {
  const supabase = await createClient();
  const [{ data: modelos }, { data: ubicaciones }, colores] = await Promise.all([
    supabase.from('vehicle_models').select('codigo_modelo').order('codigo_modelo'),
    supabase.from('locations').select('nombre').eq('activo', true).order('nombre'),
    coloresExistentes(),
  ]);
  const op = (v: string) => ({ valor: v, etiqueta: v });
  return {
    modelos: (modelos ?? []).map((m) => op(m.codigo_modelo)),
    ubicaciones: (ubicaciones ?? []).map((u) => op(u.nombre)),
    colores: colores.map(op),
  };
}
