/**
 * Formatos de la UI (SPEC §10): `S/ 1 234.56`, `US$ 1,234.56` y fechas `dd/mm/aaaa` en America/Lima.
 * Los montos se formatean con decimal.js (sin pasar por la aritmética de `number`).
 */
import { Decimal } from '@/lib/decimal';

type Monto = string | number | Decimal | null | undefined;

export const ZONA_LIMA = 'America/Lima';

function agrupar(entero: string, separador: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, separador);
}

function formatearMonto(valor: Monto, separadorMiles: string, decimales = 2): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  let d: Decimal;
  try {
    d = new Decimal(valor);
  } catch {
    return null;
  }
  if (!d.isFinite()) return null;
  const [entero = '0', fraccion] = d.abs().toFixed(decimales).split('.');
  const signo = d.isNegative() && !d.isZero() ? '-' : '';
  return `${signo}${agrupar(entero, separadorMiles)}${fraccion ? `.${fraccion}` : ''}`;
}

/** `S/ 1 234.56` (miles con espacio). Vacío → "—". */
export function formatPEN(valor: Monto): string {
  const s = formatearMonto(valor, ' ');
  return s === null ? '—' : `S/ ${s}`;
}

/** `US$ 1,234.56` (miles con coma). */
export function formatUSD(valor: Monto): string {
  const s = formatearMonto(valor, ',');
  return s === null ? '—' : `US$ ${s}`;
}

/** Número con miles separados por espacio: `1 234.5678`. */
export function formatNumero(valor: Monto, decimales = 2): string {
  return formatearMonto(valor, ' ', decimales) ?? '—';
}

/** 0.45 → `45 %`; 0.4512 → `45.12 %` (hasta `decimales`, sin ceros sobrantes). */
export function formatPorcentaje(fraccion: Monto, decimales = 2): string {
  if (fraccion === null || fraccion === undefined || fraccion === '') return '—';
  const d = new Decimal(fraccion).times(100).toDecimalPlaces(decimales);
  return `${d.toString()} %`;
}

const FECHA_SOLO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `dd/mm/aaaa`. Las columnas `date` de la BD ('2026-10-07') se formatean tal cual (sin zona,
 * para no correrse un día); los timestamps se pasan a la hora de Lima.
 */
export function formatFecha(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  if (typeof valor === 'string') {
    const m = FECHA_SOLO.exec(valor);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const fecha = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(fecha.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: ZONA_LIMA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fecha);
}

/** `dd/mm/aaaa hh:mm` en hora de Lima (24 h). */
export function formatFechaHora(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const fecha = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(fecha.getTime())) return '—';
  const partes = new Intl.DateTimeFormat('es-PE', {
    timeZone: ZONA_LIMA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const p = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((x) => x.type === tipo)?.value ?? '';
  return `${p('day')}/${p('month')}/${p('year')} ${p('hour')}:${p('minute')}`;
}

/** Fecha de negocio de hoy en Lima, `aaaa-mm-dd` (equivale a `public.fecha_lima()`). */
export function hoyLima(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_LIMA }).format(ahora);
}
