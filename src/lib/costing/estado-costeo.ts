/**
 * ¿El costeo guardado en `batch_model_costs` coincide con el que se calcula ahora a partir del lote
 * y su packing list? (pestaña Costeo, SPEC M3). La BD ya borra el costeo si cambian los montos
 * (D21); esto es una verificación adicional para la UI.
 */
import { Decimal } from '@/lib/decimal';
import type { FilaCosteo, Valor } from './prorrateo';

export type EstadoCosteo = 'sin_costeo' | 'vigente' | 'desactualizado';

/** Una fila guardada (los numeric llegan como number desde PostgREST). */
export type FilaGuardada = { model_id: string; cantidad: number } & Record<Exclude<keyof FilaCosteo, 'model_id' | 'cantidad'>, Valor>;

const COLUMNAS = [
  'tipo_cambio',
  'fob_asignado_usd',
  'impuestos_asignados_pen',
  'flete_internacional_asignado_usd',
  'gastos_agente_asignado_usd',
  'flete_nacional_asignado_pen',
  'alquiler_asignado_pen',
  'sueldos_asignado_pen',
  'publicidad_asignada_pen',
  'armado_pen',
] as const satisfies readonly (keyof FilaCosteo)[];

export function estadoCosteo(guardadas: readonly FilaGuardada[], calculadas: readonly FilaCosteo[] | null): EstadoCosteo {
  if (guardadas.length === 0) return 'sin_costeo';
  if (!calculadas || calculadas.length !== guardadas.length) return 'desactualizado';
  const porModelo = new Map(guardadas.map((g) => [g.model_id, g]));
  for (const c of calculadas) {
    const g = porModelo.get(c.model_id);
    if (!g || g.cantidad !== c.cantidad) return 'desactualizado';
    for (const col of COLUMNAS) {
      if (!new Decimal(g[col]).equals(c[col])) return 'desactualizado';
    }
  }
  return 'vigente';
}
