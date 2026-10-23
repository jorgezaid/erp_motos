'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { EstadoLote } from '@/components/estado-badge';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { Badge } from '@/components/ui/badge';
import { TIPO_LOTE } from '@/lib/etiquetas';
import { formatFecha, formatNumero } from '@/lib/format';
import type { FilaLote } from './datos';

const columnas: ColumnDef<FilaLote, unknown>[] = [
  {
    accessorKey: 'codigo_embarque',
    header: 'Código',
    cell: ({ row }) => (
      <Link href={`/lotes/${row.original.id}`} className="font-medium underline-offset-4 hover:underline">
        {row.original.codigo_embarque}
      </Link>
    ),
  },
  {
    accessorKey: 'tipo_lote',
    header: 'Origen',
    cell: ({ row }) => (
      <Badge variant={row.original.tipo_lote === 'compra_local' ? 'secondary' : 'outline'}>
        {TIPO_LOTE[row.original.tipo_lote]}
      </Badge>
    ),
  },
  {
    id: 'documento',
    header: 'DAM / Factura',
    cell: ({ row }) =>
      (row.original.tipo_lote === 'compra_local' ? row.original.nro_factura : row.original.nro_dam) ?? '—',
  },
  { accessorKey: 'proveedor', header: 'Proveedor', cell: ({ row }) => row.original.proveedor ?? '—' },
  {
    id: 'fecha',
    header: 'Llegada / Compra',
    accessorFn: (l) => l.fecha_llegada ?? l.fecha_compra,
    cell: ({ row }) => formatFecha(row.original.fecha_llegada ?? row.original.fecha_compra),
  },
  { accessorKey: 'estado', header: 'Estado', cell: ({ row }) => <EstadoLote estado={row.original.estado} /> },
  { accessorKey: 'unidades', header: 'Unidades', meta: { className: 'text-right' } },
  {
    accessorKey: 'tipo_cambio',
    header: 'TC',
    meta: { className: 'text-right' },
    // Una compra local es en soles (TC = 1): no aplica
    cell: ({ row }) =>
      row.original.tipo_lote === 'compra_local' || row.original.tipo_cambio === null
        ? '—'
        : formatNumero(row.original.tipo_cambio, 4),
  },
];

export function TablaLotes({ filas }: { filas: FilaLote[] }) {
  return (
    <TablaDatos
      columnas={columnas}
      filas={filas}
      vacio="No hay lotes. Crea el primero con «Nuevo lote» o «Nueva compra local»."
    />
  );
}
