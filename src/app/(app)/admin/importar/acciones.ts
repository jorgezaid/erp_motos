'use server';

import { revalidatePath } from 'next/cache';
import { exigirRol } from '@/lib/auth';
import { exito, fallo, mensajeDeError, type Resultado } from '@/lib/errores';
import { ErrorPlantilla, leerPlantilla } from '@/lib/importar/plantilla';
import { clavesDeBusqueda, validarPlantilla, type Analisis, type ClavesBusqueda, type EstadoBd } from '@/lib/importar/validar';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

const MAX_BYTES = 5 * 1024 * 1024;
/** Valores por consulta `.in()` (la lista va en la URL de PostgREST) */
const TROZO = 100;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Lo que ve el navegador: sin los datos para la RPC (se recalculan al confirmar, D24). */
export type AnalisisPublico = Omit<Analisis, 'datos'> & { nombreArchivo: string };

export type ResultadoImportacion = {
  lote: { id: string; codigo_embarque: string; creado: boolean; actualizado: boolean };
  ubicaciones: { creadas: number; actualizadas: number };
  modelos: { creados: number; actualizados: number };
  packing: { creadas: number; actualizadas: number };
  unidades: { creadas: number; actualizadas: number };
  baterias: { creadas: number };
};

function trozos<T>(xs: readonly T[]): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < xs.length; i += TROZO) r.push(xs.slice(i, i + TROZO));
  return r;
}

function revisar<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

/** Estado actual de la BD para lo que menciona el archivo (con el JWT del admin y su RLS). */
async function cargarEstadoBd(supabase: Supabase, claves: ClavesBusqueda): Promise<EstadoBd> {
  const [ubicaciones, modelos, lote, dam] = await Promise.all([
    supabase.from('locations').select('nombre').then(revisar),
    supabase.from('vehicle_models').select('id, codigo_modelo, voltaje_sistema').then(revisar),
    claves.codigoLote
      ? supabase.from('import_batches').select('id, codigo_embarque, estado').eq('codigo_embarque', claves.codigoLote).maybeSingle().then(revisar)
      : null,
    claves.nroDam
      ? supabase
          .from('import_batches')
          .select('codigo_embarque')
          .eq('nro_dam', claves.nroDam)
          .neq('codigo_embarque', claves.codigoLote ?? '')
          .limit(1)
          .then(revisar)
      : [],
  ]);
  const codigoDe = new Map(modelos.map((m) => [m.id, m.codigo_modelo]));

  const packing = lote
    ? (revisar(await supabase.rpc('pendientes_de_registro')) ?? [])
        .filter((p) => p.batch_id === lote.id)
        .map((p) => ({ codigo: p.codigo_modelo, cantidad: p.declaradas, registradas: p.registradas }))
    : [];

  const columnas = 'id, vin_chasis, nro_motor, batch_id, model_id';
  const porId = new Map<string, EstadoBd['unidades'][number]>();
  const consultasUnidades = [
    ...trozos(claves.vins).map((t) => supabase.from('vehicle_inventory').select(columnas).in('vin_chasis', t)),
    ...trozos(claves.motores).map((t) => supabase.from('vehicle_inventory').select(columnas).in('nro_motor', t)),
  ];
  for (const filas of await Promise.all(consultasUnidades.map((q) => q.then(revisar)))) {
    for (const u of filas) {
      porId.set(u.id, { id: u.id, vin: u.vin_chasis, motor: u.nro_motor, loteId: u.batch_id, codigoModelo: codigoDe.get(u.model_id) ?? '' });
    }
  }
  const unidades = [...porId.values()];

  const columnasBat = 'serial, vehicle_id, posicion';
  const consultasBaterias = [
    ...trozos(claves.seriales).map((t) => supabase.from('vehicle_batteries').select(columnasBat).in('serial', t)),
    ...trozos(unidades.map((u) => u.id)).map((t) => supabase.from('vehicle_batteries').select(columnasBat).in('vehicle_id', t)),
  ];
  const baterias = new Map<string, EstadoBd['baterias'][number]>();
  for (const filas of await Promise.all(consultasBaterias.map((q) => q.then(revisar)))) {
    for (const b of filas) baterias.set(b.serial, { serial: b.serial, vehicleId: b.vehicle_id, posicion: b.posicion });
  }

  return {
    ubicaciones: ubicaciones.map((u) => u.nombre),
    modelos: modelos.map((m) => ({ codigo: m.codigo_modelo, voltaje: m.voltaje_sistema })),
    lote: lote ? { id: lote.id, codigo: lote.codigo_embarque, estado: lote.estado } : null,
    loteConMismaDam: dam[0]?.codigo_embarque ?? null,
    packing,
    unidades,
    baterias: [...baterias.values()],
  };
}

/** Lee y valida el archivo del formulario en el servidor. */
async function analizar(form: FormData): Promise<Resultado<{ analisis: Analisis; nombreArchivo: string }>> {
  const archivo = form.get('archivo');
  if (!(archivo instanceof File) || archivo.size === 0) return fallo('Elige el archivo .xlsx de la plantilla.');
  if (!/\.xlsx$/i.test(archivo.name)) return fallo('El archivo debe ser .xlsx (la plantilla de datos reales v2).');
  if (archivo.size > MAX_BYTES) return fallo('El archivo pesa más de 5 MB.');

  let plantilla;
  try {
    plantilla = await leerPlantilla(await archivo.arrayBuffer());
  } catch (e) {
    if (!(e instanceof ErrorPlantilla)) throw e;
    const analisis: Analisis = { codigoLote: null, loteExiste: false, resumen: [], errores: e.errores, usuarios: [], datos: null };
    return exito({ analisis, nombreArchivo: archivo.name });
  }

  const supabase = await createClient();
  try {
    const bd = await cargarEstadoBd(supabase, clavesDeBusqueda(plantilla));
    return exito({ analisis: validarPlantilla(plantilla, bd), nombreArchivo: archivo.name });
  } catch (e) {
    return fallo(mensajeDeError({ message: e instanceof Error ? e.message : String(e) }));
  }
}

/** "Importar Excel": valida el archivo y devuelve el resumen por hoja y los errores. No guarda nada. */
export async function analizarPlantilla(form: FormData): Promise<Resultado<AnalisisPublico>> {
  await exigirRol('admin');
  const r = await analizar(form);
  if (!r.ok) return r;
  const { codigoLote, loteExiste, resumen, errores, usuarios } = r.datos.analisis;
  return exito({ codigoLote, loteExiste, resumen, errores, usuarios, nombreArchivo: r.datos.nombreArchivo });
}

/**
 * "Confirmar": vuelve a leer y validar el MISMO archivo (el navegador no envía datos ya
 * procesados) y lo guarda todo o nada con la RPC `importar_plantilla`.
 */
export async function confirmarImportacion(form: FormData): Promise<Resultado<ResultadoImportacion>> {
  await exigirRol('admin');
  const r = await analizar(form);
  if (!r.ok) return r;
  const { analisis } = r.datos;
  if (!analisis.datos) {
    return fallo(`El archivo tiene ${analisis.errores.length} error(es): corrígelos y vuelve a subirlo.`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('importar_plantilla', { p_datos: analisis.datos as unknown as Json });
  if (error) return fallo(mensajeDeError(error));

  revalidatePath('/', 'layout');
  return exito(data as unknown as ResultadoImportacion);
}
