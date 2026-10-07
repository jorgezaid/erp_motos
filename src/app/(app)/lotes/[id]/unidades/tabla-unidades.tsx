'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { EstadoUnidad } from '@/components/estado-badge';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { formatPEN } from '@/lib/format';

export type UnidadLote = {
  vehicle_id: string;
  vin_chasis: string;
  nro_motor: string;
  codigo_modelo: string;
  colores: string;
  estado: 'en_caja' | 'en_ensamble' | 'listo_en_tienda' | 'reservado' | 'vendido';
  ubicacion: string;
  baterias: string;
  inspeccion: string;
  costo: number | null;
};

const columnas: ColumnDef<UnidadLote, unknown>[] = [
  { accessorKey: 'vin_chasis', header: 'VIN', cell: ({ row }) => <span className="font-mono">{row.original.vin_chasis}</span> },
  { accessorKey: 'nro_motor', header: 'Motor', cell: ({ row }) => <span className="font-mono">{row.original.nro_motor}</span> },
  { accessorKey: 'codigo_modelo', header: 'Modelo' },
  { accessorKey: 'colores', header: 'Colores' },
  { accessorKey: 'estado', header: 'Estado', cell: ({ row }) => <EstadoUnidad estado={row.original.estado} /> },
  { accessorKey: 'ubicacion', header: 'Ubicación' },
  { accessorKey: 'baterias', header: 'Baterías' },
  { accessorKey: 'inspeccion', header: 'Inspección' },
  {
    accessorKey: 'costo',
    header: 'Costo landing',
    meta: { className: 'text-right' },
    cell: ({ row }) => formatPEN(row.original.costo),
  },
];

export function TablaUnidades({ filas }: { filas: UnidadLote[] }) {
  return <TablaDatos columnas={columnas} filas={filas} vacio="No hay unidades registradas en este lote con esos filtros." />;
}
