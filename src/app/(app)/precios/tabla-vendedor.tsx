'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { Badge } from '@/components/ui/badge';
import { formatPEN } from '@/lib/format';
import type { TipoVenta } from '@/lib/ventas';
import type { FilaPrecioVendedor } from './datos';

const columnas: ColumnDef<FilaPrecioVendedor, unknown>[] = [
  { accessorKey: 'codigo_modelo', header: 'Modelo', cell: ({ row }) => <span className="font-medium">{row.original.codigo_modelo}</span> },
  { accessorKey: 'nombre', header: 'Nombre', cell: ({ row }) => row.original.nombre || '—' },
  { accessorKey: 'voltaje', header: 'Voltaje', cell: ({ row }) => `${row.original.voltaje}V` },
  {
    accessorKey: 'disponibles',
    header: 'Disponibles',
    meta: { className: 'text-right' },
    cell: ({ row }) =>
      row.original.disponibles > 0 ? row.original.disponibles : <Badge variant="outline">Sin stock</Badge>,
  },
];

const PRECIOS: Record<TipoVenta, ColumnDef<FilaPrecioVendedor, unknown>> = {
  unidad_x1: { accessorKey: 'x1', header: 'x1 (minorista)', meta: { className: 'text-right' }, cell: ({ row }) => formatPEN(row.original.x1) },
  mayorista_x3: { accessorKey: 'x3', header: 'x3 (mayorista)', meta: { className: 'text-right' }, cell: ({ row }) => formatPEN(row.original.x3) },
  distribuidor_x6: {
    accessorKey: 'x6',
    header: 'x6 (distribuidor)',
    meta: { className: 'text-right' },
    cell: ({ row }) => formatPEN(row.original.x6),
  },
};

/** Solo las columnas de las escalas activas (D31). */
export function TablaPreciosVendedor({ filas, activas }: { filas: FilaPrecioVendedor[]; activas: TipoVenta[] }) {
  return (
    <TablaDatos
      columnas={[...columnas, ...activas.map((t) => PRECIOS[t])]}
      filas={filas}
      vacio="Aún no hay precios: se generan al liquidar cada lote."
    />
  );
}
