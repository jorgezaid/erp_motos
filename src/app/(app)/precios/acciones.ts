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
import { esquemaEscalaActiva } from '@/lib/escalas';
import { esquemaMargenes, precioManual, type EntradaMargenes } from '@/lib/esquemas/precios';
import { createClient } from '@/lib/supabase/server';

const esquemaPrecio = z.object({
  batchId: z.uuid(),
  modelId: z.uuid(),
  tipoVenta: z.enum(['unidad_x1', 'mayorista_x3', 'distribuidor_x6']),
  precio: precioManual,
});

/** SPEC §8: precio manual (redondeo comercial); vacío = vuelve al sugerido. Solo admin (RLS). */
export async function guardarPrecioManual(entrada: z.input<typeof esquemaPrecio>): Promise<Resultado> {
  await exigirRol('admin');
  const d = esquemaPrecio.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('price_list')
    .update({ precio_manual_pen: d.data.precio === null ? null : Number(d.data.precio) })
    .eq('batch_id', d.data.batchId)
    .eq('model_id', d.data.modelId)
    .eq('tipo_venta', d.data.tipoVenta)
    .select('batch_id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  revalidatePath('/precios');
  revalidatePath('/inventario');
  return exito(null);
}

/** D31: activa o desactiva una escala de venta. No regenera precios; la BD exige que quede una activa. */
export async function cambiarEscalaActiva(entrada: z.input<typeof esquemaEscalaActiva>): Promise<Resultado> {
  await exigirRol('admin');
  const d = esquemaEscalaActiva.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('price_margins')
    .update({ activo: d.data.activo })
    .eq('tipo_venta', d.data.tipoVenta)
    .select('tipo_venta');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  revalidatePath('/precios');
  revalidatePath('/ventas', 'layout');
  return exito(null);
}

/** RN-09: al cambiar los márgenes, la BD regenera los precios de todos los lotes liquidados. */
export async function guardarMargenes(entrada: EntradaMargenes): Promise<Resultado> {
  await exigirRol('admin');
  const d = esquemaMargenes.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  for (const tipo of ['unidad_x1', 'mayorista_x3', 'distribuidor_x6'] as const) {
    const { data, error } = await supabase
      .from('price_margins')
      .update({ margen_objetivo: Number(d.data[tipo]) })
      .eq('tipo_venta', tipo)
      .select('tipo_venta');
    if (error) return fallo(mensajeDeError(error));
    if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  }
  revalidatePath('/precios');
  revalidatePath('/inventario');
  return exito(null);
}
