/**
 * Identidad visual de los modelos (SPEC M2/M4): un color propio por modelo, categoría con texto +
 * ícono (se distingue también sin color), y voltaje/baterías destacados. Sin dependencias de React: sirve en Server y
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
 * Paleta de colores por modelo: 12 tonos saturados separados ~30° en el círculo cromático y
 * alternando claros y oscuros, con el ícono en blanco o casi negro según el fondo (contraste ≥ 3:1
 * para el ícono, igual en claro y oscuro). El color nunca es la única pista: van también el código
 * del modelo y el ícono y el texto de la categoría.
 */
export const PALETA_MODELOS = [
  'bg-red-600 text-white border-red-700',
  'bg-orange-400 text-orange-950 border-orange-500',
  'bg-yellow-300 text-yellow-950 border-yellow-500',
  'bg-lime-400 text-lime-950 border-lime-600',
  'bg-green-700 text-white border-green-800',
  'bg-teal-600 text-white border-teal-700',
  'bg-cyan-300 text-cyan-950 border-cyan-500',
  'bg-blue-700 text-white border-blue-800',
  'bg-violet-500 text-white border-violet-600',
  'bg-fuchsia-600 text-white border-fuchsia-700',
  'bg-pink-300 text-pink-950 border-pink-500',
  'bg-amber-800 text-white border-amber-900',
] as const;

/**
 * Semilla del hash: con ella los 8 modelos reales (XSDU-17, 23, 24, 25, 29, 31, 35 y 36) caen en
 * colores distintos. Cambiarla cambia el color de todos los modelos.
 */
const SEMILLA_COLOR = '9:';

/** FNV-1a de 32 bits: determinista y sin dependencias. */
function hashFnv1a(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Posición en `PALETA_MODELOS` del modelo, estable: depende solo del código (sin distinguir
 * mayúsculas ni espacios), no del orden del catálogo. null si no hay código.
 */
export function indiceColorModelo(codigo: string | null | undefined): number | null {
  const clave = codigo?.trim().toUpperCase();
  if (!clave) return null;
  return hashFnv1a(SEMILLA_COLOR + clave) % PALETA_MODELOS.length;
}

/** Clases del color del modelo; null si no hay código. */
export function estiloColorModelo(codigo: string | null | undefined): string | null {
  const i = indiceColorModelo(codigo);
  return i === null ? null : (PALETA_MODELOS[i] ?? null);
}

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
