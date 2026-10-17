'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { EstadoUnidad } from '@/components/estado-badge';
import { EtiquetaSinSerial } from '@/components/etiqueta-sin-serial';
import { IdentidadModelo } from '@/components/identidad-modelo';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { formatPEN } from '@/lib/format';
import type { DatosModelo } from '@/lib/modelos';

export type FilaInventario = {
  vehicle_id: string;
  vin_chasis: string;
  nro_motor: string;
  codigo_modelo: string;
  modelo: DatosModelo;
  colores: string;
  estado: 'en_caja' | 'en_ensamble' | 'listo_en_tienda' | 'reservado' | 'vendido';
  ubicacion: string;
  baterias: string;
  /** D37: baterías con serial provisional */
  provisionales: number;
  inspeccion: string;
  precio_x1: number | null;
  precio_x3: number | null;
  precio_x6: number | null;
};

const base: ColumnDef<FilaInventario, unknown>[] = [
  { accessorKey: 'vin_chasis', header: 'VIN', cell: ({ row }) => <span className="font-mono">{row.original.vin_chasis}</span> },
  { accessorKey: 'nro_motor', header: 'Motor', cell: ({ row }) => <span className="font-mono">{row.original.nro_motor}</span> },
  {
    accessorKey: 'codigo_modelo',
    header: 'Modelo',
    cell: ({ row }) => <IdentidadModelo modelo={row.original.modelo} className="min-w-56" />,
  },
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

/** D37: baterías con la etiqueta «Baterías sin serial real»; enlaza a /taller/[id] para reemplazarlas. */
function columnaBaterias(enlaceTaller: boolean): ColumnDef<FilaInventario, unknown> {
  return {
    accessorKey: 'baterias',
    header: 'Baterías',
    cell: ({ row }) => {
      const f = row.original;
      const etiqueta = <EtiquetaSinSerial cantidad={f.provisionales} />;
      return (
        <div className="grid gap-1">
          <span>{f.baterias}</span>
          {f.provisionales > 0 &&
            (enlaceTaller ? (
              <Link href={`/taller/${f.vehicle_id}`} aria-label={`Reemplazar seriales provisionales de ${f.vin_chasis}`}>
                {etiqueta}
              </Link>
            ) : (
              etiqueta
            ))}
        </div>
      );
    },
  };
}

/**
 * `verPrecios`: admin y vendedor (el técnico no ve precios; el RLS además los devuelve vacíos).
 * `enlaceTaller`: admin y técnico (pueden reemplazar los seriales provisionales).
 */
export function TablaInventario({
  filas,
  verPrecios,
  enlaceTaller,
}: {
  filas: FilaInventario[];
  verPrecios: boolean;
  enlaceTaller: boolean;
}) {
  const columnas = base.map((c) => ('accessorKey' in c && c.accessorKey === 'baterias' ? columnaBaterias(enlaceTaller) : c));
  return (
    <TablaDatos
      columnas={verPrecios ? [...columnas, ...precios] : columnas}
      filas={filas}
      vacio="No hay unidades con esos filtros."
    />
  );
}
