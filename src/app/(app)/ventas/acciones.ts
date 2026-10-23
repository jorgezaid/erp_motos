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
import { createClient } from '@/lib/supabase/server';
import { leerIdentidadModelos, modeloDeFila } from '@/lib/consultas/modelos';
import type { DatosModelo } from '@/lib/modelos';
import { MAX_FILAS_CSV, valorPermitido } from '@/lib/tabla';
import { TIPO_LOTE, type TipoLote } from '@/lib/etiquetas';
import {
  analizarCliente,
  documentoValido,
  esquemaAjustePrecio,
  esquemaCliente,
  esquemaPago,
  filtrarUnidades,
  normalizarDocumento,
  repartirDescuento,
  sumar,
  type ClienteConocido,
  type EntradaAjustePrecio,
  type EntradaCliente,
  type EntradaPago,
} from '@/lib/ventas';

const uuid = z.uuid('Registro no válido.');
const esquemaTipo = z.enum(['unidad_x1', 'mayorista_x3', 'distribuidor_x6'], 'Elige el tipo de venta.');

function revalidar(orderId?: string) {
  if (orderId) revalidatePath(`/ventas/${orderId}`);
  revalidatePath('/ventas');
  revalidatePath('/inventario');
  revalidatePath('/precios');
}

const MENSAJE_ORDEN_AJENA = 'La orden no existe, ya no está en borrador o pertenece a otro vendedor.';

/**
 * Paso 1: ¿el cliente ya compró o tiene un borrador? Para no duplicar borradores y autocompletar
 * sus datos. El vendedor lee todas las órdenes (RLS), pero solo continúa las suyas.
 */
export async function buscarCliente(tipoDocumento: string, documento: string): Promise<Resultado<ClienteConocido>> {
  const sesion = await exigirRol('admin', 'vendedor');
  const tipo = z.enum(['DNI', 'RUC', 'CE']).safeParse(tipoDocumento);
  const doc = normalizarDocumento(documento);
  if (!tipo.success || !documentoValido(tipo.data, doc)) return exito({ borrador: null, datos: null });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sales_orders')
    .select(
      'id, numero, estado, created_at, vendedor_id, cliente_nombre, cliente_telefono, cliente_email, profiles(nombre), order_items(count)',
    )
    .eq('cliente_tipo_documento', tipo.data)
    .eq('cliente_documento', doc)
    .eq('order_items.activo', true)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return fallo(mensajeDeError(error));
  const ordenes = data.map((o) => ({
    ...o,
    vendedor: o.profiles?.nombre || '—',
    motos: o.order_items[0]?.count ?? 0,
  }));
  return exito(analizarCliente(ordenes, { userId: sesion.userId, esAdmin: sesion.rol === 'admin' }));
}

/** Paso 1: tipo de venta y cliente → orden en borrador (el vendedor lo fija la BD). */
export async function crearOrden(entrada: { tipo_venta: string } & EntradaCliente): Promise<Resultado<{ id: string }>> {
  await exigirRol('admin', 'vendedor');
  const tipo = esquemaTipo.safeParse(entrada.tipo_venta);
  if (!tipo.success) return falloValidacion(tipo.error);
  const cliente = esquemaCliente.safeParse(entrada);
  if (!cliente.success) return falloValidacion(cliente.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sales_orders')
    .insert({ ...cliente.data, tipo_venta: tipo.data })
    .select('id')
    .single();
  if (error) return fallo(mensajeDeError(error));
  revalidar();
  return exito({ id: data.id });
}

/** RN-13: si cambia el tipo de venta en borrador, la BD vuelve a cotizar todos los ítems. */
export async function cambiarTipoVenta(orderId: string, tipoVenta: string): Promise<Resultado> {
  await exigirRol('admin', 'vendedor');
  const tipo = esquemaTipo.safeParse(tipoVenta);
  if (!uuid.safeParse(orderId).success || !tipo.success) return fallo('Tipo de venta no válido.');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sales_orders')
    .update({ tipo_venta: tipo.data })
    .eq('id', orderId)
    .eq('estado', 'borrador')
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_ORDEN_AJENA);
  revalidar(orderId);
  return exito(null);
}

/** Datos del cliente: en borrador todos; en una orden confirmada solo teléfono y email (RN-17). */
export async function actualizarCliente(orderId: string, entrada: EntradaCliente): Promise<Resultado> {
  await exigirRol('admin', 'vendedor');
  if (!uuid.safeParse(orderId).success) return fallo('Orden no válida.');
  const d = esquemaCliente.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);
  const supabase = await createClient();
  const { data: orden } = await supabase.from('sales_orders').select('estado').eq('id', orderId).maybeSingle();
  if (!orden) return fallo(MENSAJE_SIN_FILAS);
  const cambios =
    orden.estado === 'borrador' ? d.data : { cliente_telefono: d.data.cliente_telefono, cliente_email: d.data.cliente_email };
  const { data, error } = await supabase.from('sales_orders').update(cambios).eq('id', orderId).select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_ORDEN_AJENA);
  revalidar(orderId);
  return exito(null);
}

/**
 * Paso 2: agregar una unidad reserva la unidad (RN-12) y fija su precio desde la lista (RN-13).
 * Si otra pestaña ya la reservó, la BD responde "La unidad … no está disponible".
 */
export async function agregarUnidad(orderId: string, vehicleId: string): Promise<Resultado> {
  await exigirRol('admin', 'vendedor');
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(vehicleId).success) return fallo('Unidad no válida.');
  const supabase = await createClient();
  const { error } = await supabase.from('order_items').insert({ order_id: orderId, vehicle_id: vehicleId });
  if (error) {
    if (error.code === '23505') return fallo('La unidad no está disponible: ya está en otra orden.');
    if (error.code === '42501') return fallo(MENSAJE_ORDEN_AJENA);
    return fallo(mensajeDeError(error));
  }
  revalidar(orderId);
  return exito(null);
}

/** Quitar la unidad la devuelve a tienda (solo en borrador). */
export async function quitarUnidad(orderId: string, itemId: string): Promise<Resultado> {
  await exigirRol('admin', 'vendedor');
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(itemId).success) return fallo('Unidad no válida.');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('order_items')
    .delete()
    .eq('id', itemId)
    .eq('order_id', orderId)
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_ORDEN_AJENA);
  revalidar(orderId);
  return exito(null);
}

/** Paso 4: un pago (efectivo, transferencia o tarjeta). Varios métodos = pago mixto (RN-15). */
export async function registrarPago(orderId: string, entrada: EntradaPago): Promise<Resultado> {
  await exigirRol('admin', 'vendedor');
  if (!uuid.safeParse(orderId).success) return fallo('Orden no válida.');
  const d = esquemaPago.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from('payments')
    .insert({ order_id: orderId, metodo: d.data.metodo, monto_pen: Number(d.data.monto), referencia: d.data.referencia });
  if (error) {
    if (error.code === '42501') return fallo(MENSAJE_ORDEN_AJENA);
    return fallo(mensajeDeError(error));
  }
  revalidar(orderId);
  return exito(null);
}

export async function eliminarPago(orderId: string, pagoId: string): Promise<Resultado> {
  await exigirRol('admin', 'vendedor');
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(pagoId).success) return fallo('Pago no válido.');
  const supabase = await createClient();
  const { data, error } = await supabase.from('payments').delete().eq('id', pagoId).eq('order_id', orderId).select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_ORDEN_AJENA);
  revalidar(orderId);
  return exito(null);
}

/**
 * RN-25: precio final de una moto. La RPC valida todo (≤ lista, ≥ costo landing, motivo si
 * baja, límite % del vendedor) y nunca devuelve el costo al vendedor.
 */
export async function ajustarPrecio(orderId: string, itemId: string, entrada: EntradaAjustePrecio): Promise<Resultado> {
  await exigirRol('admin', 'vendedor');
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(itemId).success) return fallo('Unidad no válida.');
  const d = esquemaAjustePrecio.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('ajustar_precio_item', {
    p_order_id: orderId,
    p_ajustes: [{ item_id: itemId, precio: d.data.precio }],
    p_motivo: d.data.motivo,
  });
  if (error) return fallo(mensajeDeError(error));
  revalidar(orderId);
  return exito(null);
}

const esquemaMotivoDescuento = z.string().trim().min(5, 'Motivo del descuento: mínimo 5 caracteres.').max(300);

/**
 * RN-25, atajo «cuadrar con lo pagado»: si los pagos suman menos que el total, reparte la
 * diferencia entre las motos (proporcional al precio) y la aplica con la misma RPC en UNA
 * llamada (todo o nada). El reparto se recalcula aquí con lo que hay en la BD, no con lo que
 * mostró el navegador; la RPC aplica los límites (lista, costo landing y % del vendedor).
 */
export async function cuadrarConPagado(orderId: string, motivo: string): Promise<Resultado<{ descuento: string }>> {
  await exigirRol('admin', 'vendedor');
  if (!uuid.safeParse(orderId).success) return fallo('Orden no válida.');
  const m = esquemaMotivoDescuento.safeParse(motivo);
  if (!m.success) return falloValidacion(m.error);

  const supabase = await createClient();
  const [{ data: orden, error }, { data: items, error: errorItems }, { data: pagos, error: errorPagos }] = await Promise.all([
    supabase.from('sales_orders').select('estado, total_pen').eq('id', orderId).maybeSingle(),
    supabase.from('order_items').select('id, precio_unitario_pen').eq('order_id', orderId).eq('activo', true).order('created_at'),
    supabase.from('payments').select('monto_pen').eq('order_id', orderId),
  ]);
  const errorLectura = error ?? errorItems ?? errorPagos;
  if (errorLectura) return fallo(mensajeDeError(errorLectura));
  if (!orden || orden.estado !== 'borrador') return fallo(MENSAJE_ORDEN_AJENA);

  const pagado = sumar((pagos ?? []).map((p) => p.monto_pen));
  const reparto = repartirDescuento(
    (items ?? []).map((i) => ({ id: i.id, precio: i.precio_unitario_pen })),
    pagado,
  );
  if (!reparto) return fallo('No hay descuento que aplicar: registra un pago menor que el total.');

  const { error: errorRpc } = await supabase.rpc('ajustar_precio_item', {
    p_order_id: orderId,
    p_ajustes: reparto.map((r) => ({ item_id: r.id, precio: r.precio })),
    p_motivo: m.data,
  });
  if (errorRpc) return fallo(mensajeDeError(errorRpc));
  revalidar(orderId);
  return exito({ descuento: sumar(reparto.map((r) => r.descuento)) });
}

/** Paso 5: RN-14 (mínimo de la escala y pagos exactos), RN-15 y RN-16 los aplica la BD. */
export async function confirmarOrden(orderId: string): Promise<Resultado> {
  await exigirRol('admin', 'vendedor');
  if (!uuid.safeParse(orderId).success) return fallo('Orden no válida.');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sales_orders')
    .update({ estado: 'confirmada' })
    .eq('id', orderId)
    .eq('estado', 'borrador')
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_ORDEN_AJENA);
  revalidar(orderId);
  revalidatePath('/garantias');
  return exito(null);
}

const esquemaAnulacion = z.object({
  orderId: uuid,
  motivo: z.string().trim().min(5, 'Indica el motivo de la anulación (mínimo 5 caracteres).').max(500),
});

/** RN-17: solo el admin anula una venta confirmada, con motivo; las unidades vuelven a tienda. */
export async function anularOrden(entrada: z.input<typeof esquemaAnulacion>): Promise<Resultado> {
  await exigirRol('admin');
  const d = esquemaAnulacion.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sales_orders')
    .update({ estado: 'anulada', motivo_anulacion: d.data.motivo })
    .eq('id', d.data.orderId)
    .eq('estado', 'confirmada')
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo('La orden no existe o ya no está confirmada.');
  revalidar(d.data.orderId);
  revalidatePath('/garantias');
  return exito(null);
}

/** RN-18: solo se eliminan borradores (sus unidades vuelven a tienda). */
export async function eliminarOrden(orderId: string): Promise<Resultado> {
  await exigirRol('admin', 'vendedor');
  if (!uuid.safeParse(orderId).success) return fallo('Orden no válida.');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sales_orders')
    .delete()
    .eq('id', orderId)
    .eq('estado', 'borrador')
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo(MENSAJE_ORDEN_AJENA);
  revalidar();
  return exito(null);
}

export type UnidadDisponible = {
  vehicle_id: string;
  vin_chasis: string;
  codigo_modelo: string;
  modelo: DatosModelo;
  colores: string;
  ubicacion: string;
  precio: number | null;
  /** D41: solo el origen; el proveedor nunca llega al vendedor */
  tipo_lote: TipoLote | null;
};

export type BusquedaUnidades = {
  unidades: UnidadDisponible[];
  /** ¿Hay alguna unidad lista en tienda (con o sin precio)? Si no, hay que pasar por el Taller. */
  hayEnTienda: boolean;
};

const MAX_RESULTADOS = 30;

/**
 * Búsqueda de unidades para la orden (SPEC M6): por VIN, o por modelo y color, sin distinguir
 * mayúsculas ni tildes (se filtra aquí: `ilike` sí distingue tildes). Solo unidades listas en
 * tienda con precio (lotes liquidados, RN-12), con el precio de la escala de la orden.
 * `origen` (D41): '' = todos, o solo importación o compra local.
 */
export async function buscarUnidades(q: string, tipoVenta: string, origen = ''): Promise<Resultado<BusquedaUnidades>> {
  await exigirRol('admin', 'vendedor');
  const tipo = esquemaTipo.safeParse(tipoVenta);
  if (!tipo.success) return fallo('Tipo de venta no válido.');
  const columna = ({ unidad_x1: 'precio_x1', mayorista_x3: 'precio_x3', distribuidor_x6: 'precio_x6' } as const)[tipo.data];
  const filtroOrigen = valorPermitido(origen, Object.keys(TIPO_LOTE) as TipoLote[]);

  const supabase = await createClient();
  const [{ data, error }, modelos] = await Promise.all([
    supabase
      .from('v_stock')
      .select(
        'vehicle_id, vin_chasis, codigo_modelo, categoria, voltaje_sistema, cantidad_baterias_12v, potencia_motor_watts, color_primario, color_secundario, ubicacion, precio_x1, precio_x3, precio_x6, tipo_lote',
      )
      .eq('estado', 'listo_en_tienda')
      .order('codigo_modelo')
      .order('vin_chasis')
      .limit(MAX_FILAS_CSV),
    leerIdentidadModelos(),
  ]);
  if (error) return fallo(mensajeDeError(error));
  // El origen se filtra aquí para que `hayEnTienda` siga contando todas las motos en tienda
  const conPrecio = data.filter((u) => u[columna] !== null && (!filtroOrigen || u.tipo_lote === filtroOrigen));
  const encontradas = filtrarUnidades(conPrecio, q.slice(0, 60)).slice(0, MAX_RESULTADOS);
  return exito({
    hayEnTienda: data.length > 0,
    unidades: encontradas.map((u) => ({
      vehicle_id: u.vehicle_id ?? '',
      vin_chasis: u.vin_chasis ?? '',
      codigo_modelo: u.codigo_modelo ?? '',
      modelo: modeloDeFila(u, modelos),
      colores: [u.color_primario, u.color_secundario].filter(Boolean).join(' / ') || '—',
      ubicacion: u.ubicacion ?? '—',
      precio: u[columna],
      tipo_lote: u.tipo_lote,
    })),
  });
}
