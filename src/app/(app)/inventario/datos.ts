import 'server-only';
import { createClient } from '@/lib/supabase/server';

type SP = Record<string, string | string[] | undefined>;

const texto = (v: string | string[] | undefined) => (typeof v === 'string' ? v.trim().slice(0, 60) : '');

/** Filtros extra de /inventario (SPEC M4): modelo, ubicación, color y baterías sin serial real (D37). */
export function leerFiltrosInventario(sp: SP) {
  return { modelo: texto(sp.modelo), ubicacion: texto(sp.ubicacion), color: texto(sp.color), baterias: texto(sp.baterias) };
}

/** Opciones de los selects de filtro (catálogos pequeños). */
export async function opcionesFiltroInventario() {
  const supabase = await createClient();
  const [{ data: modelos }, { data: ubicaciones }, { data: colores }] = await Promise.all([
    supabase.from('vehicle_models').select('codigo_modelo').order('codigo_modelo'),
    supabase.from('locations').select('nombre').eq('activo', true).order('nombre'),
    supabase.from('vehicle_inventory').select('color_primario, color_secundario').limit(2000),
  ]);
  const setColores = new Set<string>();
  for (const c of colores ?? []) {
    if (c.color_primario) setColores.add(c.color_primario);
    if (c.color_secundario) setColores.add(c.color_secundario);
  }
  const op = (v: string) => ({ valor: v, etiqueta: v });
  return {
    modelos: (modelos ?? []).map((m) => op(m.codigo_modelo)),
    ubicaciones: (ubicaciones ?? []).map((u) => op(u.nombre)),
    colores: [...setColores].sort((a, b) => a.localeCompare(b, 'es')).map(op),
  };
}
