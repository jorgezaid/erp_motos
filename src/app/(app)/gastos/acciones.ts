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
import { esquemaGasto, esquemaRealizado, type EntradaRealizado, type Gasto } from '@/lib/esquemas/gasto';
import { BUCKET_COMPROBANTES, rutaComprobante, validarComprobante } from '@/lib/gastos';
import { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

const MENSAJE_SUBIDA = 'No se pudo subir el comprobante. Inténtalo de nuevo.';

/** numeric de la BD: los montos validados (≤ 12 dígitos enteros, 2 decimales) viajan exactos como number. */
function aFila(g: Gasto) {
  return { ...g, monto_pen: Number(g.monto_pen) };
}

/** Los gastos se ven en la lista, en planificados y en la utilidad del dashboard. */
function revalidar() {
  revalidatePath('/gastos', 'layout');
  revalidatePath('/');
}

/** Borra archivos del bucket sin interrumpir la acción (el registro ya quedó bien). */
async function borrarArchivos(supabase: Supabase, rutas: (string | null | undefined)[]) {
  const validas = rutas.filter((r): r is string => !!r);
  if (validas.length > 0) await supabase.storage.from(BUCKET_COMPROBANTES).remove(validas);
}

async function subir(supabase: Supabase, gastoId: string, archivo: File): Promise<string | null> {
  const ruta = rutaComprobante(gastoId, archivo.name);
  const { error } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  return error ? null : ruta;
}

/**
 * Crea (sin id) o actualiza un gasto. `form` lleva `datos` (JSON del formulario), y opcionalmente
 * `comprobante` (archivo nuevo) o `quitarComprobante`. Si falla la subida, no queda nada a medias.
 * RN-22: solo escribe en `gastos` y en su bucket; nunca en lotes, costeos ni precios.
 */
export async function guardarGasto(id: string | null, form: FormData): Promise<Resultado<{ id: string }>> {
  await exigirRol('admin');
  if (id !== null && !z.uuid().safeParse(id).success) return fallo('Gasto no válido.');

  let datos: unknown;
  try {
    datos = JSON.parse(String(form.get('datos') ?? ''));
  } catch {
    return fallo('Revisa los datos ingresados.');
  }
  const d = esquemaGasto.safeParse(datos);
  if (!d.success) return falloValidacion(d.error);

  const archivo = form.get('comprobante');
  const nuevo = archivo instanceof File && archivo.size > 0 ? archivo : null;
  if (nuevo) {
    const error = validarComprobante(nuevo);
    if (error) return fallo(error, { comprobante: error });
  }
  const quitar = form.get('quitarComprobante') === '1';

  const supabase = await createClient();

  if (id === null) {
    const { data, error } = await supabase.from('gastos').insert(aFila(d.data)).select('id').single();
    if (error) return fallo(mensajeDeError(error));
    if (nuevo) {
      const ruta = await subir(supabase, data.id, nuevo);
      const guardado = ruta
        ? await supabase.from('gastos').update({ comprobante_path: ruta }).eq('id', data.id).select('id')
        : null;
      if (!ruta || !guardado || guardado.error || sinFilasAfectadas(guardado.data)) {
        await borrarArchivos(supabase, [ruta]);
        await supabase.from('gastos').delete().eq('id', data.id);
        return fallo(MENSAJE_SUBIDA);
      }
    }
    revalidar();
    return exito({ id: data.id });
  }

  const { data: actual, error: errorActual } = await supabase.from('gastos').select('comprobante_path').eq('id', id).maybeSingle();
  if (errorActual) return fallo(mensajeDeError(errorActual));
  if (!actual) return fallo(MENSAJE_SIN_FILAS);

  const ruta = nuevo ? await subir(supabase, id, nuevo) : null;
  if (nuevo && !ruta) return fallo(MENSAJE_SUBIDA);
  const comprobante_path = ruta ?? (quitar ? null : actual.comprobante_path);

  const { data, error } = await supabase
    .from('gastos')
    .update({ ...aFila(d.data), comprobante_path })
    .eq('id', id)
    .select('id');
  if (error || sinFilasAfectadas(data)) {
    await borrarArchivos(supabase, [ruta]);
    return fallo(error ? mensajeDeError(error) : MENSAJE_SIN_FILAS);
  }
  if (actual.comprobante_path && actual.comprobante_path !== comprobante_path) {
    await borrarArchivos(supabase, [actual.comprobante_path]);
  }
  revalidar();
  return exito({ id });
}

/** RN-21: un planificado pasa a realizado con el monto real, la fecha del pago y el método. */
export async function marcarRealizado(id: string, entrada: EntradaRealizado): Promise<Resultado> {
  await exigirRol('admin');
  if (!z.uuid().safeParse(id).success) return fallo('Gasto no válido.');
  const d = esquemaRealizado.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('gastos')
    .update({ estado: 'realizado', monto_pen: Number(d.data.monto_pen), fecha: d.data.fecha, metodo_pago: d.data.metodo_pago })
    .eq('id', id)
    .eq('estado', 'planificado')
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo('No se aplicó ningún cambio: el gasto no existe o ya estaba realizado.');
  revalidar();
  return exito(null);
}

/** Borra el gasto y su comprobante. */
export async function borrarGasto(id: string): Promise<Resultado> {
  await exigirRol('admin');
  if (!z.uuid().safeParse(id).success) return fallo('Gasto no válido.');

  const supabase = await createClient();
  const { data, error } = await supabase.from('gastos').delete().eq('id', id).select('comprobante_path');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_SIN_FILAS);
  await borrarArchivos(supabase, data.map((g) => g.comprobante_path));
  revalidar();
  return exito(null);
}
