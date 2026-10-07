import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/** Lote completo (solo admin por RLS). Memoizado por petición: lo usan el layout y cada pestaña. */
export const obtenerLote = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from('import_batches').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  return data;
});

/** Packing list con el código de cada modelo, ordenado por código (como el prorrateo). */
export const obtenerPacking = cache(async (batchId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('batch_items')
    .select('*, vehicle_models(codigo_modelo, nombre_comercial, voltaje_sistema)')
    .eq('batch_id', batchId);
  if (error) throw new Error(error.message);
  return data
    .map((i) => ({ ...i, codigo_modelo: i.vehicle_models?.codigo_modelo ?? '' }))
    .sort((a, b) => (a.codigo_modelo < b.codigo_modelo ? -1 : 1));
});
