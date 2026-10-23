'use server';

import { revalidatePath } from 'next/cache';
import { exigirRol } from '@/lib/auth';
import { exito, fallo, falloValidacion, mensajeDeError, type Resultado } from '@/lib/errores';
import { esquemaNuevaCompraLocal, PROVEEDOR_NUEVO, type EntradaNuevaCompraLocal } from '@/lib/esquemas/compra-local';
import { esquemaNuevoLote, type EntradaNuevoLote } from '@/lib/esquemas/lote';
import { createClient } from '@/lib/supabase/server';

export async function crearLote(entrada: EntradaNuevoLote): Promise<Resultado<{ id: string }>> {
  await exigirRol('admin');
  const d = esquemaNuevoLote.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from('import_batches').insert(d.data).select('id').single();
  if (error) return fallo(mensajeDeError(error));
  revalidatePath('/lotes');
  return exito({ id: data.id });
}

/**
 * Compra local (D41): lote en soles con TC = 1. Si el proveedor es nuevo se registra primero; si
 * después falla el lote, se borra ese proveedor para no dejarlo a medias.
 */
export async function crearCompraLocal(entrada: EntradaNuevaCompraLocal): Promise<Resultado<{ id: string }>> {
  await exigirRol('admin');
  const d = esquemaNuevaCompraLocal.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);
  const c = d.data;
  const supabase = await createClient();

  let proveedorId = c.proveedor_id;
  const nuevo = proveedorId === PROVEEDOR_NUEVO;
  if (nuevo) {
    const ruc = c.proveedor_ruc.trim();
    const { data, error } = await supabase
      .from('proveedores')
      .insert({ nombre: c.proveedor_nombre.trim(), ruc: ruc || null })
      .select('id')
      .single();
    if (error) return fallo(mensajeDeError(error));
    proveedorId = data.id;
  }

  const { data, error } = await supabase
    .from('import_batches')
    .insert({
      tipo_lote: 'compra_local',
      tipo_cambio: 1,
      codigo_embarque: c.codigo_embarque,
      nro_factura: c.nro_factura,
      fecha_compra: c.fecha_compra,
      precio_incluye_igv: c.precio_incluye_igv,
      proveedor_id: proveedorId,
    })
    .select('id')
    .single();
  if (error) {
    if (nuevo) await supabase.from('proveedores').delete().eq('id', proveedorId);
    return fallo(mensajeDeError(error));
  }
  revalidatePath('/lotes');
  if (nuevo) revalidatePath('/admin/proveedores');
  return exito({ id: data.id });
}
