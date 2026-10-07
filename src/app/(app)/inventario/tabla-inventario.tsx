'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { EstadoUnidad } from '@/components/estado-badge';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { formatPEN } from '@/lib/format';

export type FilaInventario = {
  vehicle_id: string;
  vin_chasis: string;
  nro_motor: string;
  codigo_modelo: string;
  voltaje: string;
  colores: string;
  estado: 'en_caja' | 'en_ensamble' | 'listo_en_tienda' | 'reservado' | 'vendido';
  ubicacion: string;
  baterias: string;
  inspeccion: string;
  precio_x1: number | null;
  precio_x3: number | null;
  precio_x6: number | null;
};

const base: ColumnDef<FilaInventario, unknown>[] = [
  { accessorKey: 'vin_chasis', header: 'VIN', cell: ({ row }) => <span className="font-mono">{row.original.vin_chasis}</span> },
  { accessorKey: 'nro_motor', header: 'Motor', cell: ({ row }) => <span className="font-mono">{row.original.nro_motor}</span> },
  { accessorKey: 'codigo_modelo', header: 'Modelo' },
  { accessorKey: 'voltaje', header: 'Voltaje' },
  { accessorKey: 'colores', header: 'Colores' },
  { accessorKey: 'estado', header: 'Estado', cell: ({ row }) => <EstadoUnidad estado={row.original.estado} /> },
  { accessorKey: 'ubicacion', header: 'Ubicación' },
  { accessorKey: 'baterias', header: 'Baterías' },
  { accessorKey: 'inspeccion', header: 'Inspección' },
];

const precios: ColumnDef<FilaInventario, unknown>[] = (['precio_x1', 'precio_x3', 'precio_x6'] as const).map((k) => ({
  accessorKey: k,
  header: k.replace('precio_', ''),
  meta: { className: 'text-right' },
  cell: ({ row }: { row: { original: FilaInventario } }) => formatPEN(row.original[k]),
}));

/** `verPrecios`: admin y vendedor (el técnico no ve precios; el RLS además los devuelve vacíos). */
export function TablaInventario({ filas, verPrecios }: { filas: FilaInventario[]; verPrecios: boolean }) {
  return (
    <TablaDatos
      columnas={verPrecios ? [...base, ...precios] : base}
      filas={filas}
      vacio="No hay unidades con esos filtros."
    />
  );
}
