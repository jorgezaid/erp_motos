'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { Badge } from '@/components/ui/badge';
import { CATEGORIA } from '@/lib/etiquetas';
import { formatNumero, formatUSD } from '@/lib/format';
import type { Database } from '@/types/database';

type Fila = Database['public']['Tables']['vehicle_models']['Row'];

const columnas: ColumnDef<Fila, unknown>[] = [
  {
    accessorKey: 'codigo_modelo',
    header: 'Código',
    cell: ({ row }) => (
      <Link href={`/admin/modelos/${row.original.id}`} className="font-medium underline-offset-4 hover:underline">
        {row.original.codigo_modelo}
      </Link>
    ),
  },
  { accessorKey: 'nombre_comercial', header: 'Nombre', cell: ({ row }) => row.original.nombre_comercial ?? '—' },
  { accessorKey: 'categoria', header: 'Categoría', cell: ({ row }) => CATEGORIA[row.original.categoria] },
  {
    accessorKey: 'voltaje_sistema',
    header: 'Voltaje',
    cell: ({ row }) =>
      `${row.original.voltaje_sistema}V · ${row.original.cantidad_baterias_12v} bat.${row.original.tipo_bateria === 'litio' ? ' de litio' : ''}` +
      (row.original.tiene_techo ? ' · con techo' : ''),
  },
  { accessorKey: 'amperaje_bateria_ah', header: 'Ah', meta: { className: 'text-right' } },
  { accessorKey: 'potencia_motor_watts', header: 'W', meta: { className: 'text-right' } },
  {
    accessorKey: 'volumen_cbm_unitario',
    header: 'CBM',
    meta: { className: 'text-right' },
    cell: ({ row }) => formatNumero(row.original.volumen_cbm_unitario, 4),
  },
  {
    accessorKey: 'exw_usd_unitario',
    header: 'EXW',
    meta: { className: 'text-right' },
    cell: ({ row }) => formatUSD(row.original.exw_usd_unitario),
  },
  {
    accessorKey: 'garantia_meses',
    header: 'Garantía',
    cell: ({ row }) => `${row.original.garantia_meses} m · bat. ${row.original.garantia_baterias_meses} m`,
  },
  {
    accessorKey: 'activo',
    header: 'Estado',
    cell: ({ row }) =>
      row.original.activo ? <Badge variant="secondary">Activo</Badge> : <Badge variant="outline">Inactivo</Badge>,
  },
];

export function TablaModelos({ filas }: { filas: Fila[] }) {
  return <TablaDatos columnas={columnas} filas={filas} vacio="No hay modelos. Crea el primero con «Nuevo modelo»." />;
}
