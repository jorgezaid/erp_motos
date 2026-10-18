import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { minimosPorTipo, tiposActivos } from '@/lib/escalas';
import { createClient } from '@/lib/supabase/server';

/** Orden con sus ítems activos, pagos y vendedor (sin costos: lo ve cualquier rol con acceso a ventas). */
export const obtenerOrden = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: orden, error }, { data: items }, { data: pagos }, { data: margenes }, { data: config }] = await Promise.all([
    supabase.from('sales_orders').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('order_items')
      .select(
        'id, vehicle_id, precio_unitario_pen, precio_lista_pen, motivo_ajuste, activo, vehicle_inventory(vin_chasis, nro_motor, color_primario, color_secundario, vehicle_models(codigo_modelo, nombre_comercial, voltaje_sistema, garantia_meses, garantia_baterias_meses))',
      )
      .eq('order_id', id)
      .order('created_at'),
    supabase.from('payments').select('id, metodo, monto_pen, referencia, created_at').eq('order_id', id).order('created_at'),
    supabase.from('price_margins').select('tipo_venta, cantidad_minima, activo'),
    supabase.from('configuracion_ventas').select('descuento_max_vendedor').maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  if (!orden) notFound();

  const { data: vendedor } = orden.vendedor_id
    ? await supabase.from('profiles').select('nombre').eq('id', orden.vendedor_id).maybeSingle()
    : { data: null };

  return {
    orden,
    // En una orden anulada los ítems quedan inactivos: se muestran igual (histórico)
    items: (items ?? []).filter((i) => i.activo || orden.estado === 'anulada'),
    pagos: pagos ?? [],
    minimos: minimosPorTipo(margenes ?? []),
    activas: tiposActivos(margenes ?? []),
    /** RN-25: descuento máximo del vendedor por moto (fracción; 0 si no se pudo leer). */
    descuentoMaxVendedor: config?.descuento_max_vendedor ?? 0,
    vendedor: vendedor?.nombre ?? '—',
  };
});

export type OrdenCompleta = Awaited<ReturnType<typeof obtenerOrden>>;
