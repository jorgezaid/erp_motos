import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { MAX_FILAS_CSV } from '@/lib/tabla';
import { PREFIJO_PROVISIONAL } from '@/lib/taller';

/** Clave de una fila de `v_batch_reconciliation`: lote y modelo. */
export const claveLoteModelo = (batchId: string | null, codigoModelo: string | null) => `${batchId}:${codigoModelo}`;

/**
 * D37: motos con «Baterías sin serial real» (seriales PROV-) por lote y modelo, para la
 * Auditoría. Si se pasa `batchId`, solo las de ese lote.
 */
export async function motosSinSerialRealPorLote(batchId?: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  let consulta = supabase
    .from('vehicle_batteries')
    .select('vehicle_id, vehicle_inventory!inner(batch_id, vehicle_models(codigo_modelo))')
    .ilike('serial', `${PREFIJO_PROVISIONAL}%`);
  if (batchId) consulta = consulta.eq('vehicle_inventory.batch_id', batchId);
  const { data, error } = await consulta.limit(MAX_FILAS_CSV * 6);
  if (error) throw new Error(error.message);

  const motos = new Map<string, Set<string>>();
  for (const b of data) {
    const clave = claveLoteModelo(b.vehicle_inventory.batch_id, b.vehicle_inventory.vehicle_models?.codigo_modelo ?? null);
    motos.set(clave, (motos.get(clave) ?? new Set()).add(b.vehicle_id));
  }
  return new Map([...motos].map(([k, v]) => [k, v.size]));
}

/** D37: cuántas motos tienen alguna batería con serial provisional (aviso del Taller). */
export async function contarMotosSinSerialReal(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicle_batteries')
    .select('vehicle_id')
    .ilike('serial', `${PREFIJO_PROVISIONAL}%`)
    .limit(MAX_FILAS_CSV * 6);
  if (error) throw new Error(error.message);
  return new Set(data.map((b) => b.vehicle_id)).size;
}
