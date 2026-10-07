import { ESTADO_LOTE } from '@/lib/etiquetas';
import { formatFecha } from '@/lib/format';
import { obtenerLote } from './datos';

/** Pestaña Datos (se vuelve editable en la tarea 5.2). */
export default async function DatosLote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lote = await obtenerLote(id);
  const filas: [string, string][] = [
    ['Código de embarque', lote.codigo_embarque],
    ['N.º de DAM', lote.nro_dam ?? '—'],
    ['Proveedor', lote.proveedor ?? '—'],
    ['Fecha de embarque', formatFecha(lote.fecha_embarque)],
    ['Fecha de llegada', formatFecha(lote.fecha_llegada)],
    ['Estado', ESTADO_LOTE[lote.estado]],
  ];
  return (
    <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      {filas.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
