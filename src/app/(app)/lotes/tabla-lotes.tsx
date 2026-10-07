'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { EstadoLote } from '@/components/estado-badge';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { formatFecha, formatNumero } from '@/lib/format';
import type { FilaLote } from './datos';

const columnas: ColumnDef<FilaLote, unknown>[] = [
  {
    accessorKey: 'codigo_embarque',
    header: 'Código de embarque',
    cell: ({ row }) => (
      <Link href={`/lotes/${row.original.id}`} className="font-medium underline-offset-4 hover:underline">
        {row.original.codigo_embarque}
      </Link>
    ),
  },
  { accessorKey: 'nro_dam', header: 'DAM', cell: ({ row }) => row.original.nro_dam ?? '—' },
  { accessorKey: 'proveedor', header: 'Proveedor', cell: ({ row }) => row.original.proveedor ?? '—' },
  { accessorKey: 'fecha_llegada', header: 'Llegada', cell: ({ row }) => formatFecha(row.original.fecha_llegada) },
  { accessorKey: 'estado', header: 'Estado', cell: ({ row }) => <EstadoLote estado={row.original.estado} /> },
  { accessorKey: 'unidades', header: 'Unidades', meta: { className: 'text-right' } },
  {
    accessorKey: 'tipo_cambio',
    header: 'TC',
    meta: { className: 'text-right' },
    cell: ({ row }) => (row.original.tipo_cambio === null ? '—' : formatNumero(row.original.tipo_cambio, 4)),
  },
];

export function TablaLotes({ filas }: { filas: FilaLote[] }) {
  return <TablaDatos columnas={columnas} filas={filas} vacio="No hay lotes. Crea el primero con «Nuevo lote»." />;
}
