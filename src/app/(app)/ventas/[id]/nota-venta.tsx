import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Decimal } from '@/lib/decimal';
import { COBERTURA, METODO_PAGO, TIPO_VENTA } from '@/lib/etiquetas';
import { formatFecha, formatFechaHora, formatPEN } from '@/lib/format';
import type { Database } from '@/types/database';
import type { OrdenCompleta } from './datos';

type Garantia = Pick<Database['public']['Tables']['warranties']['Row'], 'vehicle_id' | 'cobertura' | 'fecha_inicio' | 'fecha_fin' | 'anulada'>;

/**
 * Nota de venta interna (SPEC §1: no es comprobante SUNAT). Se imprime con window.print();
 * el sidebar y los botones llevan `print:hidden`.
 */
export function NotaVenta({ datos, garantias }: { datos: OrdenCompleta; garantias: Garantia[] }) {
  const { orden, items, pagos, vendedor } = datos;
  const garantiasDe = (vehicleId: string) => garantias.filter((g) => g.vehicle_id === vehicleId);

  return (
    <article className="grid gap-6 rounded-md border p-6 print:border-0 print:p-0" aria-label="Nota de venta">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold">ERP Motos — Vehículos eléctricos</p>
          <p className="text-sm text-muted-foreground">Nota de venta interna · no es comprobante de pago</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">N.º {String(orden.numero).padStart(6, '0')}</p>
          <p className="text-sm">{formatFechaHora(orden.confirmada_at ?? orden.created_at)}</p>
          {orden.estado === 'anulada' && <p className="font-semibold text-destructive">ANULADA</p>}
        </div>
      </header>

      <section className="grid gap-1 text-sm sm:grid-cols-2">
        <p>
          <span className="text-muted-foreground">Cliente:</span> {orden.cliente_nombre}
        </p>
        <p>
          <span className="text-muted-foreground">{orden.cliente_tipo_documento}:</span> {orden.cliente_documento}
        </p>
        <p>
          <span className="text-muted-foreground">Teléfono:</span> {orden.cliente_telefono ?? '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Email:</span> {orden.cliente_email ?? '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Tipo de venta:</span> {TIPO_VENTA[orden.tipo_venta]}
        </p>
        <p>
          <span className="text-muted-foreground">Vendedor:</span> {vendedor}
        </p>
      </section>

      <Table aria-label="Detalle de la venta">
        <TableHeader>
          <TableRow>
            <TableHead>Modelo</TableHead>
            <TableHead>VIN</TableHead>
            <TableHead>Motor</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Garantía</TableHead>
            <TableHead className="text-right">Precio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i) => {
            const v = i.vehicle_inventory;
            return (
              <TableRow key={i.id}>
                <TableCell>
                  {v?.vehicle_models?.codigo_modelo}
                  {v?.vehicle_models?.nombre_comercial && (
                    <span className="block text-xs text-muted-foreground">{v.vehicle_models.nombre_comercial}</span>
                  )}
                </TableCell>
                <TableCell className="font-mono">{v?.vin_chasis}</TableCell>
                <TableCell className="font-mono">{v?.nro_motor}</TableCell>
                <TableCell>{[v?.color_primario, v?.color_secundario].filter(Boolean).join(' / ') || '—'}</TableCell>
                <TableCell className="text-xs whitespace-normal">
                  {garantiasDe(i.vehicle_id).map((g) => (
                    <span key={g.cobertura} className={g.anulada ? 'block line-through' : 'block'}>
                      {COBERTURA[g.cobertura]}: {formatFecha(g.fecha_inicio)} – {formatFecha(g.fecha_fin)}
                    </span>
                  ))}
                </TableCell>
                <TableCell className="text-right">
                  {formatPEN(i.precio_unitario_pen)}
                  {i.precio_unitario_pen < i.precio_lista_pen && (
                    <span className="block text-xs text-muted-foreground">
                      Lista {formatPEN(i.precio_lista_pen)} · desc.{' '}
                      {formatPEN(new Decimal(i.precio_lista_pen).minus(i.precio_unitario_pen).toFixed(2))}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5}>Total (incluye IGV)</TableCell>
            <TableCell className="text-right font-semibold" data-testid="total-nota">
              {formatPEN(orden.total_pen)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      <section className="grid gap-1 text-sm">
        <p className="font-medium">
          Pagos{orden.metodo_pago ? ` · ${METODO_PAGO[orden.metodo_pago]}` : ''}
        </p>
        <ul aria-label="Pagos">
          {pagos.map((p) => (
            <li key={p.id}>
              {METODO_PAGO[p.metodo]}: {formatPEN(p.monto_pen)}
              {p.referencia ? ` (ref. ${p.referencia})` : ''}
            </li>
          ))}
        </ul>
      </section>

      {orden.estado === 'anulada' && (
        <p className="text-sm">
          <span className="font-medium">Anulada el {formatFechaHora(orden.anulada_at)}.</span> Motivo: {orden.motivo_anulacion}
        </p>
      )}
    </article>
  );
}
