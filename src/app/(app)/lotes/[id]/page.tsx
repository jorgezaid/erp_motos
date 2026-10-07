import type { EntradaDatosLote } from '@/lib/esquemas/lote';
import { ESTADO_LOTE } from '@/lib/etiquetas';
import { obtenerLote } from './datos';
import { FormularioDatos } from './formulario-datos';

/** Pestaña Datos (SPEC M3): código de embarque, DAM, proveedor, fechas y estado. */
export default async function DatosLote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lote = await obtenerLote(id);
  const liquidado = lote.estado === 'liquidado';

  const inicial: EntradaDatosLote = {
    codigo_embarque: lote.codigo_embarque,
    nro_dam: lote.nro_dam ?? '',
    proveedor: lote.proveedor ?? '',
    fecha_embarque: lote.fecha_embarque ?? '',
    fecha_llegada: lote.fecha_llegada ?? '',
    // En liquidado el campo es solo informativo (no se envía)
    estado: (liquidado ? ESTADO_LOTE.liquidado : lote.estado) as EntradaDatosLote['estado'],
    notas: lote.notas ?? '',
  };

  return <FormularioDatos id={lote.id} inicial={inicial} liquidado={liquidado} />;
}
