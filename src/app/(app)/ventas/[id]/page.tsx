import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { EstadoOrden } from '@/components/estado-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { exigirRol } from '@/lib/auth';
import { TIPO_VENTA } from '@/lib/etiquetas';
import { createClient } from '@/lib/supabase/server';
import type { TipoVenta } from '@/lib/ventas';
import { BotonAnular, BotonImprimir, DialogoContacto } from './acciones-detalle';
import { obtenerOrden } from './datos';
import { EditorOrden, type ItemOrden } from './editor-orden';
import { NotaVenta } from './nota-venta';

/** /ventas/[id] (SPEC M6): POS de la orden en borrador; nota de venta y anulación de la confirmada. */
export default async function PaginaOrden({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirRol('admin', 'vendedor');
  const { id } = await params;
  const datos = await obtenerOrden(id);
  const { orden, items, pagos, minimos, activas, vendedor } = datos;
  const puedeEditar = sesion.rol === 'admin' || orden.vendedor_id === sesion.userId;

  const encabezado = (
    <>
      <p className="mb-2 text-sm text-muted-foreground print:hidden">
        <Link href="/ventas" className="hover:underline">
          Ventas
        </Link>{' '}
        / #{orden.numero}
      </p>
      <div className="print:hidden">
        <Encabezado
          titulo={
            <span className="flex flex-wrap items-center gap-3">
              Venta #{orden.numero} <EstadoOrden estado={orden.estado} />
            </span>
          }
          descripcion={`${orden.cliente_nombre} · ${orden.cliente_tipo_documento} ${orden.cliente_documento} · ${TIPO_VENTA[orden.tipo_venta as TipoVenta]} · Vendedor: ${vendedor}`}
        >
          {orden.estado !== 'borrador' && <BotonImprimir />}
          {orden.estado === 'confirmada' && puedeEditar && (
            <DialogoContacto
              orderId={orden.id}
              inicial={{
                cliente_nombre: orden.cliente_nombre,
                cliente_tipo_documento: orden.cliente_tipo_documento,
                cliente_documento: orden.cliente_documento,
                cliente_telefono: orden.cliente_telefono ?? '',
                cliente_email: orden.cliente_email ?? '',
              }}
            />
          )}
          {orden.estado === 'confirmada' && sesion.rol === 'admin' && <BotonAnular orderId={orden.id} numero={orden.numero} />}
        </Encabezado>
      </div>
    </>
  );

  if (orden.estado === 'borrador') {
    if (!puedeEditar) {
      return (
        <>
          {encabezado}
          <Alert>
            <AlertDescription>Esta orden en borrador pertenece a otro vendedor: solo puedes verla.</AlertDescription>
          </Alert>
        </>
      );
    }
    const esAdmin = sesion.rol === 'admin';
    // Costo landing (RN-25: mínimo y margen al ajustar el precio): solo se consulta y se
    // serializa para el admin (CLAUDE.md regla 5)
    const costos = new Map<string, number | null>();
    if (esAdmin && items.length > 0) {
      const supabase = await createClient();
      const { data } = await supabase
        .from('v_vehicle_costs')
        .select('vehicle_id, costo_landing_calculado_pen')
        .in(
          'vehicle_id',
          items.map((i) => i.vehicle_id),
        );
      for (const c of data ?? []) if (c.vehicle_id) costos.set(c.vehicle_id, c.costo_landing_calculado_pen);
    }
    const lineas: ItemOrden[] = items.map((i) => {
      const v = i.vehicle_inventory;
      return {
        id: i.id,
        vin: v?.vin_chasis ?? '',
        modelo: v?.vehicle_models?.codigo_modelo ?? '',
        colores: [v?.color_primario, v?.color_secundario].filter(Boolean).join(' / ') || '—',
        precio: i.precio_unitario_pen,
        lista: i.precio_lista_pen,
        motivo: i.motivo_ajuste,
        ...(esAdmin ? { costo: costos.get(i.vehicle_id) ?? null } : {}),
      };
    });
    return (
      <>
        {encabezado}
        <EditorOrden
          orderId={orden.id}
          numero={orden.numero}
          tipo={orden.tipo_venta as TipoVenta}
          total={orden.total_pen}
          items={lineas}
          // payments.metodo nunca es 'mixto' (CHECK de la tabla): eso solo existe en la orden
          pagos={pagos.map((p) => ({ ...p, metodo: p.metodo as Exclude<typeof p.metodo, 'mixto'> }))}
          minimos={minimos}
          activas={activas}
          esAdmin={esAdmin}
          descuentoMax={datos.descuentoMaxVendedor}
        />
      </>
    );
  }

  const supabase = await createClient();
  const { data: garantias } = await supabase
    .from('warranties')
    .select('vehicle_id, cobertura, fecha_inicio, fecha_fin, anulada')
    .eq('order_id', orden.id);

  return (
    <>
      {encabezado}
      <NotaVenta datos={datos} garantias={garantias ?? []} />
    </>
  );
}
