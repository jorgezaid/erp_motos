'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { exigirRol } from '@/lib/auth';
import {
  exito,
  fallo,
  falloValidacion,
  MENSAJE_SIN_FILAS,
  mensajeDeError,
  sinFilasAfectadas,
  type Resultado,
} from '@/lib/errores';
import {
  esquemaCostosLote,
  esquemaDatosLote,
  esquemaLineaPacking,
  type EntradaCostosLote,
  type EntradaDatosLote,
  type EntradaLineaPacking,
} from '@/lib/esquemas/lote';
import { createClient } from '@/lib/supabase/server';
import { costeoDelLote } from './costeo/calculo';

function idValido(id: string) {
  return z.uuid().safeParse(id).success;
}

function revalidarLote(id: string) {
  revalidatePath(`/lotes/${id}`, 'layout');
  revalidatePath('/lotes');
}

/**
 * Pestaña Datos. Si el lote está liquidado solo se guardan las notas (RN-08); el resto lo
 * rechazaría la BD de todos modos.
 */
export async function guardarDatosLote(id: string, entrada: EntradaDatosLote): Promise<Resultado> {
  await exigirRol('admin');
  if (!idValido(id)) return fallo('Lote no válido.');
  const supabase = await createClient();

  const { data: actual } = await supabase.from('import_batches').select('estado').eq('id', id).maybeSingle();
  if (!actual) return fallo(MENSAJE_SIN_FILAS);

  let cambios;
  if (actual.estado === 'liquidado') {
    const notas = z.string().trim().max(2000).safeParse(entrada.notas);
    if (!notas.success) return fallo('Notas: máximo 2000 caracteres.');
    cambios = { notas: notas.data || null };
  } else {
    const d = esquemaDatosLote.safeParse(entrada);
    if (!d.success) return falloValidacion(d.error);
    cambios = d.data;
  }

  const { data, error } = await supabase.from('import_batches').update(cambios).eq('id', id).select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  revalidarLote(id);
  return exito(null);
}

/** Pestaña Costos. Cambiar un monto borra el costeo guardado (D21): hay que recalcularlo. */
export async function guardarCostosLote(id: string, entrada: EntradaCostosLote): Promise<Resultado> {
  await exigirRol('admin');
  if (!idValido(id)) return fallo('Lote no válido.');
  const d = esquemaCostosLote.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  // Valores validados con su escala (≤ 14 dígitos): viajan exactos como number en el JSON
  const c = d.data;
  const cambios = {
    tipo_cambio: c.tipo_cambio === null ? null : Number(c.tipo_cambio),
    fob_total_usd: Number(c.fob_total_usd),
    flete_internacional_usd: Number(c.flete_internacional_usd),
    gastos_agente_usd: Number(c.gastos_agente_usd),
    ad_valorem_pen: Number(c.ad_valorem_pen),
    igv_pen: Number(c.igv_pen),
    ipm_pen: Number(c.ipm_pen),
    percepcion_pen: Number(c.percepcion_pen),
    impuestos_recuperables_al_costo: c.impuestos_recuperables_al_costo,
    flete_nacional_pen: Number(c.flete_nacional_pen),
    alquiler_periodo_pen: Number(c.alquiler_periodo_pen),
    sueldos_periodo_pen: Number(c.sueldos_periodo_pen),
    publicidad_inicial_pen: Number(c.publicidad_inicial_pen),
    costo_armado_unitario_pen: Number(c.costo_armado_unitario_pen),
  };

  const supabase = await createClient();
  const { data, error } = await supabase.from('import_batches').update(cambios).eq('id', id).select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  revalidarLote(id);
  return exito(null);
}

// ---------------------------------------------------------------- costeo y liquidación

/**
 * Guarda el costeo (RN-06): se recalcula aquí con los datos actuales de la BD y la RPC
 * guardar_costeo vuelve a validar los invariantes en SQL (D7).
 */
export async function guardarCosteo(batchId: string): Promise<Resultado> {
  await exigirRol('admin');
  if (!idValido(batchId)) return fallo('Lote no válido.');
  const supabase = await createClient();

  const [{ data: lote }, { data: items, error: errorItems }] = await Promise.all([
    supabase.from('import_batches').select('*').eq('id', batchId).maybeSingle(),
    supabase.from('batch_items').select('*, vehicle_models(codigo_modelo)').eq('batch_id', batchId),
  ]);
  if (!lote) return fallo(MENSAJE_SIN_FILAS);
  if (errorItems) return fallo(mensajeDeError(errorItems));

  const costeo = costeoDelLote(
    lote,
    items.map((i) => ({ ...i, codigo_modelo: i.vehicle_models?.codigo_modelo ?? '' })),
  );
  if (!costeo.ok) return fallo(costeo.error);

  // La RPC recibe el formato FilaCosteo (sin el código de modelo, que solo es para mostrar)
  const filas = costeo.filas.map((f) => {
    const fila: Record<string, string | number> = { ...f };
    delete fila.codigo_modelo;
    return fila;
  });
  const { error } = await supabase.rpc('guardar_costeo', { p_batch_id: batchId, p_filas: filas });
  if (error) return fallo(mensajeDeError(error));
  revalidarLote(batchId);
  return exito(null);
}

/** RN-07/RN-09: la BD valida el costeo vigente y genera la matriz de precios. */
export async function liquidarLote(batchId: string): Promise<Resultado> {
  await exigirRol('admin');
  if (!idValido(batchId)) return fallo('Lote no válido.');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('import_batches')
    .update({ estado: 'liquidado' })
    .eq('id', batchId)
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  revalidarLote(batchId);
  revalidatePath('/precios');
  return exito(null);
}

/** RN-08: reabrir (vuelve a "en almacén") solo si no hay unidades reservadas ni vendidas. */
export async function reabrirLote(batchId: string): Promise<Resultado> {
  await exigirRol('admin');
  if (!idValido(batchId)) return fallo('Lote no válido.');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('import_batches')
    .update({ estado: 'en_almacen' })
    .eq('id', batchId)
    .eq('estado', 'liquidado')
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo('El lote no está liquidado o no tienes permiso para reabrirlo.');
  revalidarLote(batchId);
  revalidatePath('/precios');
  return exito(null);
}

// ---------------------------------------------------------------- packing list

function filaPacking(l: z.output<typeof esquemaLineaPacking>) {
  return {
    cantidad_packing_list: l.cantidad_packing_list,
    cantidad_dam: l.cantidad_dam,
    exw_usd_unitario: Number(l.exw_usd_unitario),
    volumen_cbm_unitario: Number(l.volumen_cbm_unitario),
  };
}

/** Agrega un modelo al packing list (cambiarlo borra el costeo guardado, D21). */
export async function agregarLinea(batchId: string, entrada: EntradaLineaPacking): Promise<Resultado> {
  await exigirRol('admin');
  if (!idValido(batchId)) return fallo('Lote no válido.');
  const d = esquemaLineaPacking.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from('batch_items')
    .insert({ batch_id: batchId, model_id: d.data.model_id, ...filaPacking(d.data) });
  if (error) {
    if (error.code === '23505') return fallo('Ese modelo ya está en el packing list: edita su línea.');
    return fallo(mensajeDeError(error));
  }
  revalidarLote(batchId);
  return exito(null);
}

export async function actualizarLinea(batchId: string, itemId: string, entrada: EntradaLineaPacking): Promise<Resultado> {
  await exigirRol('admin');
  if (!idValido(batchId) || !idValido(itemId)) return fallo('Línea no válida.');
  const d = esquemaLineaPacking.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('batch_items')
    .update(filaPacking(d.data))
    .eq('id', itemId)
    .eq('batch_id', batchId)
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  revalidarLote(batchId);
  return exito(null);
}

export async function eliminarLinea(batchId: string, itemId: string): Promise<Resultado> {
  await exigirRol('admin');
  if (!idValido(batchId) || !idValido(itemId)) return fallo('Línea no válida.');

  const supabase = await createClient();
  const { data, error } = await supabase.from('batch_items').delete().eq('id', itemId).eq('batch_id', batchId).select('id');
  if (error) {
    if (error.code === '23503') return fallo('No se puede quitar el modelo: ya tiene unidades registradas en este lote.');
    return fallo(mensajeDeError(error));
  }
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  revalidarLote(batchId);
  return exito(null);
}
