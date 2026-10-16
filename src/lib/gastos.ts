/**
 * Reglas de la pantalla de gastos (SPEC M9): mes de cada gasto, filtros por mes, totales con
 * decimal.js y validación del comprobante. Los gastos nunca tocan el costo de las motos (RN-22).
 */
import { Decimal } from '@/lib/decimal';
import type { Database } from '@/types/database';

type Enums = Database['public']['Enums'];
export type EstadoGasto = Enums['estado_gasto'];
export type CategoriaGasto = Enums['categoria_gasto'];

/** Valor del filtro de mes que muestra todos los meses. */
export const TODOS_LOS_MESES = 'todos';

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

const NOMBRES_MES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** El mes (aaaa-mm) de un gasto: el del pago si está realizado; si no, el de la fecha estimada. */
export function mesDeGasto(g: { estado: EstadoGasto; fecha: string | null; fecha_estimada: string | null }): string | null {
  const f = g.estado === 'realizado' ? g.fecha : g.fecha_estimada;
  return f ? f.slice(0, 7) : null;
}

/** `?mes=`: aaaa-mm válido, `todos` (null = sin filtro) o, si falta o no es válido, el mes actual. */
export function leerMes(valor: string | undefined, mesActual: string): string | null {
  if (valor === TODOS_LOS_MESES) return null;
  return valor && MES.test(valor) ? valor : mesActual;
}

/** Primer día del mes y del mes siguiente (aaaa-mm-dd), para filtrar `>= desde` y `< hasta`. */
export function rangoMes(mes: string): { desde: string; hasta: string } | null {
  const m = MES.exec(mes);
  if (!m) return null;
  const anio = Number(m[1]);
  const n = Number(m[2]);
  const [a2, m2] = n === 12 ? [anio + 1, 1] : [anio, n + 1];
  return { desde: `${mes}-01`, hasta: `${a2}-${String(m2).padStart(2, '0')}-01` };
}

/**
 * Filtro `or` de PostgREST para los gastos de un mes según `mesDeGasto`. Un realizado siempre
 * tiene `fecha` y un planificado nunca (RN-21, CHECK), así que basta mirar si `fecha` es nula.
 */
export function filtroMes(mes: string): string | null {
  const r = rangoMes(mes);
  if (!r) return null;
  return (
    `and(fecha.gte.${r.desde},fecha.lt.${r.hasta}),` +
    `and(fecha.is.null,fecha_estimada.gte.${r.desde},fecha_estimada.lt.${r.hasta})`
  );
}

/** `2026-10` → `Octubre 2026`. */
export function etiquetaMes(mes: string): string {
  const m = MES.exec(mes);
  return m ? `${NOMBRES_MES[Number(m[2]) - 1]} ${m[1]}` : mes;
}

/** Meses para el filtro: los que tienen gastos más el actual, del más reciente al más antiguo. */
export function mesesDisponibles(fechas: readonly (string | null)[], mesActual: string): string[] {
  const meses = new Set([mesActual]);
  for (const f of fechas) if (f && MES.test(f.slice(0, 7))) meses.add(f.slice(0, 7));
  return [...meses].sort().reverse();
}

type Monto = number | string;

export type TotalCategoria = { categoria: CategoriaGasto; realizado: string; planificado: string; total: string };
export type TotalesGastos = {
  cantidad: number;
  realizado: string;
  planificado: string;
  total: string;
  /** Solo las categorías con gastos, de mayor a menor total */
  porCategoria: TotalCategoria[];
};

/** Totales de un conjunto de gastos, separados por estado y por categoría (decimal.js). */
export function totalesGastos(filas: readonly { estado: EstadoGasto; categoria: CategoriaGasto; monto_pen: Monto }[]): TotalesGastos {
  const cero = () => ({ realizado: new Decimal(0), planificado: new Decimal(0) });
  const total = cero();
  const porCategoria = new Map<CategoriaGasto, ReturnType<typeof cero>>();
  for (const f of filas) {
    const c = porCategoria.get(f.categoria) ?? cero();
    c[f.estado] = c[f.estado].plus(f.monto_pen);
    porCategoria.set(f.categoria, c);
    total[f.estado] = total[f.estado].plus(f.monto_pen);
  }
  return {
    cantidad: filas.length,
    realizado: total.realizado.toFixed(2),
    planificado: total.planificado.toFixed(2),
    total: total.realizado.plus(total.planificado).toFixed(2),
    porCategoria: [...porCategoria]
      .map(([categoria, t]) => ({ categoria, suma: t.realizado.plus(t.planificado), ...t }))
      .sort((a, b) => b.suma.comparedTo(a.suma) || a.categoria.localeCompare(b.categoria))
      .map((t) => ({
        categoria: t.categoria,
        realizado: t.realizado.toFixed(2),
        planificado: t.planificado.toFixed(2),
        total: t.suma.toFixed(2),
      })),
  };
}

export type GrupoMes<F> = { mes: string; filas: F[]; total: string };

/** Planificados agrupados por mes estimado (del más próximo al más lejano), con el total de cada mes. */
export function agruparPorMesEstimado<F extends { fecha_estimada: string | null; monto_pen: Monto }>(filas: readonly F[]): GrupoMes<F>[] {
  const grupos = new Map<string, F[]>();
  for (const f of filas) {
    const mes = f.fecha_estimada?.slice(0, 7) ?? 'sin-fecha';
    grupos.set(mes, [...(grupos.get(mes) ?? []), f]);
  }
  return [...grupos]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, fs]) => ({
      mes,
      filas: [...fs].sort((a, b) => (a.fecha_estimada ?? '').localeCompare(b.fecha_estimada ?? '')),
      total: fs.reduce((s, f) => s.plus(f.monto_pen), new Decimal(0)).toFixed(2),
    }));
}

/** Suma de montos (decimal.js). */
export function sumarMontos(filas: readonly { monto_pen: Monto }[]): string {
  return filas.reduce((s, f) => s.plus(f.monto_pen), new Decimal(0)).toFixed(2);
}

// ---------------------------------------------------------------- comprobante (RN-24)

export const BUCKET_COMPROBANTES = 'comprobantes-gastos';
/** Límite de la Server Action (bodySizeLimit 6 MB en next.config); el bucket admite 10 MB. */
export const MAX_BYTES_COMPROBANTE = 5 * 1024 * 1024;
export const TIPOS_COMPROBANTE = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export const ACEPTA_COMPROBANTE = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';

/** null si el archivo es válido; si no, el mensaje para el usuario. */
export function validarComprobante(archivo: { name: string; size: number; type: string }): string | null {
  if (!(TIPOS_COMPROBANTE as readonly string[]).includes(archivo.type))
    return 'Comprobante: solo se aceptan PDF o imágenes JPG, PNG o WEBP.';
  if (archivo.size === 0) return 'Comprobante: el archivo está vacío.';
  if (archivo.size > MAX_BYTES_COMPROBANTE) return 'Comprobante: el archivo supera los 5 MB.';
  return null;
}

/** Ruta en el bucket: `<gasto_id>/<marca de tiempo>-<nombre sin tildes ni caracteres raros>`. */
export function rutaComprobante(gastoId: string, nombre: string, ahora: number = Date.now()): string {
  const limpio =
    nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^[-.]+|-+$/g, '')
      .slice(-80) || 'comprobante';
  return `${gastoId}/${ahora}-${limpio}`;
}
