import { opcionesProveedores } from '@/lib/consultas/proveedores';
import type { EntradaDatosCompraLocal } from '@/lib/esquemas/compra-local';
import type { EntradaDatosLote } from '@/lib/esquemas/lote';
import { ESTADO_LOTE } from '@/lib/etiquetas';
import { obtenerLote } from './datos';
import { FormularioDatos } from './formulario-datos';
import { FormularioDatosCompraLocal } from './formulario-datos-compra-local';

/** Pestaña Datos (SPEC M3): código de embarque, DAM, proveedor, fechas y estado; o la factura de una compra local (D41). */
export default async function DatosLote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lote = await obtenerLote(id);
  const liquidado = lote.estado === 'liquidado';
  const proveedores = await opcionesProveedores(lote.proveedor_id);
  // En liquidado el campo es solo informativo (no se envía)
  const estado = liquidado ? ESTADO_LOTE.liquidado : lote.estado;

  if (lote.tipo_lote === 'compra_local') {
    const inicial: EntradaDatosCompraLocal = {
      codigo_embarque: lote.codigo_embarque,
      nro_factura: lote.nro_factura ?? '',
      proveedor_id: lote.proveedor_id ?? '',
      fecha_compra: lote.fecha_compra ?? '',
      fecha_llegada: lote.fecha_llegada ?? '',
      estado: estado as EntradaDatosCompraLocal['estado'],
      notas: lote.notas ?? '',
    };
    return <FormularioDatosCompraLocal id={lote.id} inicial={inicial} liquidado={liquidado} proveedores={proveedores} />;
  }

  const inicial: EntradaDatosLote = {
    codigo_embarque: lote.codigo_embarque,
    nro_dam: lote.nro_dam ?? '',
    proveedor_id: lote.proveedor_id ?? '',
    fecha_embarque: lote.fecha_embarque ?? '',
    fecha_llegada: lote.fecha_llegada ?? '',
    estado: estado as EntradaDatosLote['estado'],
    notas: lote.notas ?? '',
  };
  return <FormularioDatos id={lote.id} inicial={inicial} liquidado={liquidado} proveedores={proveedores} />;
}
