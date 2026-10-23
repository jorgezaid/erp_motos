'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { FilaProveedor } from './datos';
import { DialogoProveedor } from './dialogo-proveedor';

const columnas: ColumnDef<FilaProveedor, unknown>[] = [
  { accessorKey: 'nombre', header: 'Nombre', cell: ({ row }) => <span className="font-medium">{row.original.nombre}</span> },
  { accessorKey: 'ruc', header: 'RUC', cell: ({ row }) => <span className="font-mono">{row.original.ruc ?? '—'}</span> },
  { accessorKey: 'telefono', header: 'Teléfono', cell: ({ row }) => row.original.telefono ?? '—' },
  {
    accessorKey: 'lotes',
    header: 'Lotes',
    meta: { className: 'text-right' },
    cell: ({ row }) =>
      row.original.lotes > 0 ? (
        <Link href={`/lotes?proveedor=${row.original.id}`} className="underline-offset-4 hover:underline">
          {row.original.lotes}
        </Link>
      ) : (
        0
      ),
  },
  {
    accessorKey: 'activo',
    header: 'Estado',
    cell: ({ row }) =>
      row.original.activo ? <Badge variant="secondary">Activo</Badge> : <Badge variant="outline">Inactivo</Badge>,
  },
  {
    id: 'acciones',
    header: '',
    enableSorting: false,
    meta: { className: 'text-right' },
    cell: ({ row }) => (
      <DialogoProveedor
        id={row.original.id}
        inicial={{
          nombre: row.original.nombre,
          ruc: row.original.ruc ?? '',
          telefono: row.original.telefono ?? '',
          activo: row.original.activo,
        }}
        disparador={
          <Button variant="outline" size="sm" aria-label={`Editar ${row.original.nombre}`}>
            Editar
          </Button>
        }
      />
    ),
  },
];

export function TablaProveedores({ filas }: { filas: FilaProveedor[] }) {
  return <TablaDatos columnas={columnas} filas={filas} vacio="No hay proveedores con esos filtros." />;
}
