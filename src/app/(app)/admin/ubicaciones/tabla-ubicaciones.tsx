'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TIPO_UBICACION } from '@/lib/etiquetas';
import type { Database } from '@/types/database';
import { DialogoUbicacion } from './dialogo-ubicacion';

type Fila = Database['public']['Tables']['locations']['Row'];

const columnas: ColumnDef<Fila, unknown>[] = [
  { accessorKey: 'nombre', header: 'Nombre', cell: ({ row }) => <span className="font-medium">{row.original.nombre}</span> },
  { accessorKey: 'tipo', header: 'Tipo', cell: ({ row }) => TIPO_UBICACION[row.original.tipo] },
  { accessorKey: 'direccion', header: 'Dirección', cell: ({ row }) => row.original.direccion ?? '—' },
  {
    accessorKey: 'activo',
    header: 'Estado',
    cell: ({ row }) =>
      row.original.activo ? <Badge variant="secondary">Activa</Badge> : <Badge variant="outline">Inactiva</Badge>,
  },
  {
    id: 'acciones',
    header: '',
    enableSorting: false,
    meta: { className: 'text-right' },
    cell: ({ row }) => (
      <DialogoUbicacion
        id={row.original.id}
        inicial={{
          nombre: row.original.nombre,
          tipo: row.original.tipo,
          direccion: row.original.direccion ?? '',
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

export function TablaUbicaciones({ filas }: { filas: Fila[] }) {
  return <TablaDatos columnas={columnas} filas={filas} vacio="No hay ubicaciones con esos filtros." />;
}
