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
  type EntradaCostosLote,
  type EntradaDatosLote,
} from '@/lib/esquemas/lote';
import { createClient } from '@/lib/supabase/server';

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
