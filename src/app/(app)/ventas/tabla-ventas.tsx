'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { EstadoOrden } from '@/components/estado-badge';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { Button } from '@/components/ui/button';
import { METODO_PAGO, TIPO_VENTA_CORTO } from '@/lib/etiquetas';
import { formatFechaHora, formatPEN } from '@/lib/format';
import { antiguedad, motosReservadas } from '@/lib/ventas';
import type { FilaVenta } from './datos';

const columnas: ColumnDef<FilaVenta, unknown>[] = [
  {
    accessorKey: 'numero',
    header: 'N.º',
    cell: ({ row }) => (
      <Link href={`/ventas/${row.original.id}`} className="font-medium underline-offset-4 hover:underline">
        #{row.original.numero}
      </Link>
    ),
  },
  { accessorKey: 'fecha', header: 'Fecha', cell: ({ row }) => formatFechaHora(row.original.fecha) },
  { accessorKey: 'cliente_nombre', header: 'Cliente' },
  { accessorKey: 'documento', header: 'Documento' },
  { accessorKey: 'tipo_venta', header: 'Escala', cell: ({ row }) => TIPO_VENTA_CORTO[row.original.tipo_venta] },
  { accessorKey: 'total_pen', header: 'Total', meta: { className: 'text-right' }, cell: ({ row }) => formatPEN(row.original.total_pen) },
  { accessorKey: 'metodo_pago', header: 'Pago', cell: ({ row }) => (row.original.metodo_pago ? METODO_PAGO[row.original.metodo_pago] : '—') },
  {
    accessorKey: 'estado',
    header: 'Estado',
    cell: ({ row }) => {
      const v = row.original;
      return (
        <div className="grid gap-0.5">
          <EstadoOrden estado={v.estado} />
          {/* Borradores olvidados: llevan días y bloquean stock */}
          {v.estado === 'borrador' && (
            <span className="text-xs text-muted-foreground" data-testid={`borrador-${v.numero}`}>
              {antiguedad(v.creada)} · {motosReservadas(v.motos)}
            </span>
          )}
        </div>
      );
    },
  },
  { accessorKey: 'vendedor', header: 'Vendedor' },
  {
    id: 'acciones',
    header: '',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.puedeContinuar && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/ventas/${row.original.id}`} aria-label={`Continuar la orden #${row.original.numero}`}>
            Continuar
          </Link>
        </Button>
      ),
  },
];

export function TablaVentas({ filas }: { filas: FilaVenta[] }) {
  return <TablaDatos columnas={columnas} filas={filas} vacio="No hay ventas con esos filtros." />;
}
