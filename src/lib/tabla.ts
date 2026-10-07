/**
 * Utilidades de los listados (SPEC §10 y §11): búsqueda, filtro por estado, paginación en el
 * servidor de 50 filas y exportación a CSV.
 */

export const FILAS_POR_PAGINA = 50;
/** Tope de filas al exportar a CSV (protege al servidor de exportaciones enormes). */
export const MAX_FILAS_CSV = 5000;

export type ParamsTabla = { q: string; estado: string; pagina: number };

type SearchParams = Record<string, string | string[] | undefined>;

function primero(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export function leerParams(sp: SearchParams): ParamsTabla {
  const pagina = Number.parseInt(primero(sp.pagina), 10);
  return {
    q: primero(sp.q).trim().slice(0, 100),
    estado: primero(sp.estado).trim(),
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** Rango para `.range(desde, hasta)` de supabase-js (ambos inclusive). */
export function rango(pagina: number, porPagina = FILAS_POR_PAGINA): [number, number] {
  const desde = (pagina - 1) * porPagina;
  return [desde, desde + porPagina - 1];
}

/**
 * Filtro `or` de PostgREST para buscar `q` en varias columnas con ilike.
 * Quita los caracteres que rompen la sintaxis del filtro (`,()*:"\`) y escapa los comodines de LIKE.
 * Devuelve null si no hay nada que buscar.
 */
export function filtroBusqueda(q: string, columnas: readonly string[]): string | null {
  const limpio = q
    .replace(/[,()*:"\\]/g, ' ')
    .replace(/[%_]/g, (c) => `\\${c}`)
    .trim();
  if (!limpio || columnas.length === 0) return null;
  return columnas.map((c) => `${c}.ilike.*${limpio}*`).join(',');
}

/** Solo acepta valores de una lista conocida (p. ej. los de un enum) para filtrar. */
export function valorPermitido<T extends string>(valor: string, permitidos: readonly T[]): T | null {
  return (permitidos as readonly string[]).includes(valor) ? (valor as T) : null;
}

export type ColumnaCsv<F> = { encabezado: string; valor: (fila: F) => string | number | boolean | null | undefined };

function celdaCsv(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Evita la inyección de fórmulas al abrir el CSV en Excel
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV con BOM UTF-8 (para que Excel muestre bien las tildes), separado por comas y con CRLF. */
export function aCsv<F>(filas: readonly F[], columnas: readonly ColumnaCsv<F>[]): string {
  const lineas = [columnas.map((c) => celdaCsv(c.encabezado)).join(',')];
  for (const f of filas) lineas.push(columnas.map((c) => celdaCsv(c.valor(f))).join(','));
  return `\uFEFF${lineas.join('\r\n')}\r\n`;
}

/** Respuesta HTTP de descarga de un CSV. */
export function respuestaCsv(csv: string, nombreArchivo: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreArchivo.replace(/[^\w.-]/g, '_')}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Query string con los filtros actuales (para paginación y para el enlace de CSV). */
export function queryString(params: Partial<ParamsTabla> & Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || (k === 'pagina' && v === 1)) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
