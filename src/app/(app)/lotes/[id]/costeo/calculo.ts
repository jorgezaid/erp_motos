import 'server-only';
import { calcularProrrateo, ErrorProrrateo, type FilaCosteo } from '@/lib/costing/prorrateo';
import type { Database } from '@/types/database';

type Lote = Database['public']['Tables']['import_batches']['Row'];
type Item = Database['public']['Tables']['batch_items']['Row'] & { codigo_modelo: string };

export type ResultadoCosteo = { ok: true; filas: (FilaCosteo & { codigo_modelo: string })[] } | { ok: false; error: string };

/**
 * Prorrateo del lote (SPEC §7) a partir de los datos de la BD. Lo usan la vista previa y la
 * Server Action que guarda: el costeo siempre se recalcula en el servidor (nunca se confía en el cliente).
 */
export function costeoDelLote(lote: Lote, items: readonly Item[]): ResultadoCosteo {
  try {
    const filas = calcularProrrateo(
      {
        tipo_cambio: lote.tipo_cambio,
        fob_total_usd: lote.fob_total_usd,
        flete_internacional_usd: lote.flete_internacional_usd,
        gastos_agente_usd: lote.gastos_agente_usd,
        impuestos_asignables_pen: lote.impuestos_asignables_pen ?? 0,
        flete_nacional_pen: lote.flete_nacional_pen,
        alquiler_periodo_pen: lote.alquiler_periodo_pen,
        sueldos_periodo_pen: lote.sueldos_periodo_pen,
        publicidad_inicial_pen: lote.publicidad_inicial_pen,
        costo_armado_unitario_pen: lote.costo_armado_unitario_pen,
      },
      items.map((i) => ({
        model_id: i.model_id,
        codigo_modelo: i.codigo_modelo,
        cantidad_packing_list: i.cantidad_packing_list,
        exw_total_usd: i.exw_total_usd ?? 0,
        cbm_total: i.cbm_total ?? 0,
      })),
    );
    const codigo = new Map(items.map((i) => [i.model_id, i.codigo_modelo]));
    return {
      ok: true,
      filas: filas
        .map((f) => ({ ...f, codigo_modelo: codigo.get(f.model_id) ?? '' }))
        .sort((a, b) => (a.codigo_modelo < b.codigo_modelo ? -1 : 1)),
    };
  } catch (e) {
    if (e instanceof ErrorProrrateo) return { ok: false, error: e.message };
    throw e;
  }
}
