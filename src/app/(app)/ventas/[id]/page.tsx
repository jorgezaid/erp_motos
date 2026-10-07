import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { EstadoOrden } from '@/components/estado-badge';
import { exigirRol } from '@/lib/auth';
import { TIPO_VENTA } from '@/lib/etiquetas';
import { formatFechaHora, formatPEN } from '@/lib/format';
import type { TipoVenta } from '@/lib/ventas';
import { obtenerOrden } from './datos';
import { EditorOrden, type ItemOrden } from './editor-orden';

/** /ventas/[id] (SPEC M6): POS de la orden en borrador; detalle de la confirmada o anulada. */
export default async function PaginaOrden({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirRol('admin', 'vendedor');
  const { id } = await params;
  const { orden, items, pagos, minimos, vendedor } = await obtenerOrden(id);
  const puedeEditar = sesion.rol === 'admin' || orden.vendedor_id === sesion.userId;

  const lineas: ItemOrden[] = items.map((i) => {
    const v = i.vehicle_inventory;
    return {
      id: i.id,
      vin: v?.vin_chasis ?? '',
      modelo: v?.vehicle_models?.codigo_modelo ?? '',
      colores: [v?.color_primario, v?.color_secundario].filter(Boolean).join(' / ') || '—',
      precio: i.precio_unitario_pen,
    };
  });

  return (
    <>
      <p className="mb-2 text-sm text-muted-foreground print:hidden">
        <Link href="/ventas" className="hover:underline">
          Ventas
        </Link>{' '}
        / #{orden.numero}
      </p>
      <Encabezado
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            Venta #{orden.numero} <EstadoOrden estado={orden.estado} />
          </span>
        }
        descripcion={`${orden.cliente_nombre} · ${orden.cliente_tipo_documento} ${orden.cliente_documento} · ${TIPO_VENTA[orden.tipo_venta as TipoVenta]} · Vendedor: ${vendedor}`}
      />
      {orden.estado === 'borrador' && puedeEditar ? (
        <EditorOrden
          orderId={orden.id}
          numero={orden.numero}
          tipo={orden.tipo_venta as TipoVenta}
          total={orden.total_pen}
          items={lineas}
          // payments.metodo nunca es 'mixto' (CHECK de la tabla): eso solo existe en la orden
          pagos={pagos.map((p) => ({ ...p, metodo: p.metodo as Exclude<typeof p.metodo, 'mixto'> }))}
          minimos={minimos}
        />
      ) : (
        <section className="grid gap-2 text-sm">
          {orden.estado === 'borrador' && <p>Esta orden en borrador pertenece a otro vendedor: solo puedes verla.</p>}
          <p>
            Total {formatPEN(orden.total_pen)} · {lineas.length} unidad(es)
            {orden.confirmada_at ? ` · confirmada el ${formatFechaHora(orden.confirmada_at)}` : ''}
          </p>
          <ul className="list-disc pl-5">
            {lineas.map((l) => (
              <li key={l.id}>
                {l.vin} — {l.modelo} — {formatPEN(l.precio)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
