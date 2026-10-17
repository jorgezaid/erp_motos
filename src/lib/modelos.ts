/**
 * Identidad visual de los modelos (SPEC M2/M4): categoría con texto + ícono + color (se distingue
 * también sin color), y voltaje/baterías destacados. Sin dependencias de React: sirve en Server y
 * Client Components.
 */
import { CATEGORIA } from '@/lib/etiquetas';
import { formatNumero } from '@/lib/format';
import type { Database } from '@/types/database';

export type Categoria = Database['public']['Enums']['vehicle_category'];

export type DatosModelo = {
  codigo_modelo: string | null;
  nombre_comercial?: string | null;
  categoria: Categoria | null;
  voltaje_sistema: number | null;
  cantidad_baterias_12v?: number | null;
  potencia_motor_watts?: number | null;
};

/**
 * Colores por categoría con contraste AA (texto -900/-100 sobre fondo -100/-950), en claro y
 * oscuro. El borde ayuda a separar la ficha del fondo de la tarjeta.
 */
export const ESTILO_CATEGORIA: Record<Categoria, string> = {
  bicimoto: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-800',
  trimoto_pasajeros: 'bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950 dark:text-violet-100 dark:border-violet-800',
  trimoto_carga: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
};

/** Nombre de la categoría para mostrar ("Trimoto de carga"); "Sin categoría" si falta. */
export function textoCategoria(categoria: Categoria | null): string {
  return categoria ? CATEGORIA[categoria] : 'Sin categoría';
}

/** M2: baterías de 12V derivadas del voltaje (48V = 4, 60V = 5, 72V = 6) si no vienen calculadas. */
export function bateriasDelModelo(m: Pick<DatosModelo, 'voltaje_sistema' | 'cantidad_baterias_12v'>): number | null {
  if (m.cantidad_baterias_12v) return m.cantidad_baterias_12v;
  return m.voltaje_sistema ? m.voltaje_sistema / 12 : null;
}

/** «60V · 5 baterías» (lo que más importa en el taller). */
export function textoEnergia(m: Pick<DatosModelo, 'voltaje_sistema' | 'cantidad_baterias_12v'>): string {
  const n = bateriasDelModelo(m);
  if (!m.voltaje_sistema || !n) return '—';
  return `${m.voltaje_sistema}V · ${n} ${n === 1 ? 'batería' : 'baterías'}`;
}

export type ConteoTaller = { en_caja: number; en_ensamble: number };

/** Unidades en caja y en ensamble por código de modelo (encabezados de la cola del taller). */
export function contarPorModelo(
  filas: readonly { codigo_modelo: string | null; estado: string | null }[],
): Map<string, ConteoTaller> {
  const conteos = new Map<string, ConteoTaller>();
  for (const f of filas) {
    if (!f.codigo_modelo || (f.estado !== 'en_caja' && f.estado !== 'en_ensamble')) continue;
    const c = conteos.get(f.codigo_modelo) ?? { en_caja: 0, en_ensamble: 0 };
    c[f.estado] += 1;
    conteos.set(f.codigo_modelo, c);
  }
  return conteos;
}

/** «9 en caja · 3 en ensamble» (omite el que esté en cero salvo que ambos lo estén). */
export function textoConteoTaller(c: ConteoTaller | undefined): string {
  const { en_caja = 0, en_ensamble = 0 } = c ?? {};
  const partes = [en_caja > 0 && `${en_caja} en caja`, en_ensamble > 0 && `${en_ensamble} en ensamble`].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'sin unidades en el taller';
}

/** Agrupa filas por código de modelo, ordenando los grupos por código (y respetando el orden dentro). */
export function agruparPorModelo<F extends { codigo_modelo: string | null }>(filas: readonly F[]): { codigo: string; filas: F[] }[] {
  const grupos = new Map<string, F[]>();
  for (const f of filas) {
    const codigo = f.codigo_modelo ?? '—';
    grupos.set(codigo, [...(grupos.get(codigo) ?? []), f]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
    .map(([codigo, fs]) => ({ codigo, filas: fs }));
}

/** «1 200 W» con separador de miles (como el resto de la app); null si no se conoce. */
export function textoPotencia(watts: number | null | undefined): string | null {
  if (!watts) return null;
  return `${formatNumero(watts, 0)} W`;
}
