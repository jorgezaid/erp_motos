'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { MoveRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EditarColor } from '@/components/editar-color';
import { EstadoUnidad } from '@/components/estado-badge';
import { EtiquetaSinSerial } from '@/components/etiqueta-sin-serial';
import { IdentidadModelo } from '@/components/identidad-modelo';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatPEN } from '@/lib/format';
import type { DatosModelo } from '@/lib/modelos';
import { DialogoMover, SelectorUbicacion, type Ubicacion } from './mover-ubicacion';

export type FilaInventario = {
  vehicle_id: string;
  vin_chasis: string;
  nro_motor: string;
  codigo_modelo: string;
  modelo: DatosModelo;
  colores: string;
  color_primario: string | null;
  color_secundario: string | null;
  /** D39: la sesión puede cambiar el color de esta moto (`puedeEditarColor`) */
  editarColor: boolean;
  estado: 'en_caja' | 'en_ensamble' | 'listo_en_tienda' | 'reservado' | 'vendido';
  ubicacion: string;
  ubicacion_id: string | null;
  /** D40: la sesión puede mover esta moto (`puedeMoverUnidad`) */
  mover: boolean;
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

/** VIN que abre la moto en /taller/[id] (baterías, inspección e historial de ubicaciones). */
function columnaVin(): ColumnDef<FilaInventario, unknown> {
  return {
    accessorKey: 'vin_chasis',
    header: 'VIN',
    cell: ({ row }) => (
      <Link href={`/taller/${row.original.vehicle_id}`} className="font-mono hover:underline">
        {row.original.vin_chasis}
      </Link>
    ),
  };
}

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

/** D39: colores con «Editar color» en las filas que la sesión puede cambiar. */
function columnaColores(sugerencias: string[]): ColumnDef<FilaInventario, unknown> {
  return {
    accessorKey: 'colores',
    header: 'Colores',
    cell: ({ row }) => {
      const f = row.original;
      return (
        <div className="flex items-center gap-1">
          <span>{f.colores}</span>
          {f.editarColor && (
            <EditarColor
              vehicleId={f.vehicle_id}
              vin={f.vin_chasis}
              primario={f.color_primario}
              secundario={f.color_secundario}
              sugerencias={sugerencias}
              compacto
            />
          )}
        </div>
      );
    },
  };
}

/** D40: la ubicación es un selector en las filas que la sesión puede mover. */
function columnaUbicacion(ubicaciones: Ubicacion[]): ColumnDef<FilaInventario, unknown> {
  return {
    accessorKey: 'ubicacion',
    header: 'Ubicación',
    cell: ({ row }) => {
      const f = row.original;
      return f.mover ? (
        <SelectorUbicacion vehicleId={f.vehicle_id} vin={f.vin_chasis} ubicacionId={f.ubicacion_id} ubicaciones={ubicaciones} />
      ) : (
        f.ubicacion
      );
    },
  };
}

/**
 * `verPrecios`: admin y vendedor (el técnico no ve precios; el RLS además los devuelve vacíos).
 * `enlaceTaller`: admin y técnico (abren la moto en /taller/[id] y reemplazan los seriales provisionales).
 * `coloresExistentes`: sugerencias del editor de color (D39).
 * `ubicaciones`: destinos para mover motos (D40); `null` si la sesión no puede moverlas.
 */
export function TablaInventario({
  filas,
  verPrecios,
  enlaceTaller,
  coloresExistentes,
  ubicaciones,
}: {
  filas: FilaInventario[];
  verPrecios: boolean;
  enlaceTaller: boolean;
  coloresExistentes: string[];
  ubicaciones: Ubicacion[] | null;
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [moviendo, setMoviendo] = useState<string[] | null>(null);
  const movibles = filas.filter((f) => f.mover).map((f) => f.vehicle_id);
  // Solo cuenta lo que sigue en la página y se puede mover (tras filtrar o vender, cambia)
  const elegidas = movibles.filter((id) => seleccion.has(id));
  const todas = movibles.length > 0 && elegidas.length === movibles.length;

  function alternar(id: string, marcada: boolean) {
    setSeleccion((s) => {
      const n = new Set(s);
      if (marcada) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  const columnaSeleccion: ColumnDef<FilaInventario, unknown> = {
    id: 'seleccion',
    enableSorting: false,
    header: () => (
      <Checkbox
        aria-label="Seleccionar todas las motos de la página"
        checked={todas ? true : elegidas.length > 0 ? 'indeterminate' : false}
        disabled={movibles.length === 0}
        onCheckedChange={(v) => setSeleccion(new Set(v === true ? movibles : []))}
      />
    ),
    cell: ({ row }) =>
      row.original.mover ? (
        <Checkbox
          aria-label={`Seleccionar ${row.original.vin_chasis}`}
          checked={seleccion.has(row.original.vehicle_id)}
          onCheckedChange={(v) => alternar(row.original.vehicle_id, v === true)}
        />
      ) : null,
  };

  const columnas = base.map((c) => {
    if (!('accessorKey' in c)) return c;
    if (c.accessorKey === 'vin_chasis' && enlaceTaller) return columnaVin();
    if (c.accessorKey === 'baterias') return columnaBaterias(enlaceTaller);
    if (c.accessorKey === 'colores') return columnaColores(coloresExistentes);
    if (c.accessorKey === 'ubicacion' && ubicaciones) return columnaUbicacion(ubicaciones);
    return c;
  });
  const conSeleccion = ubicaciones ? [columnaSeleccion, ...columnas] : columnas;

  return (
    <>
      <TablaDatos
        columnas={verPrecios ? [...conSeleccion, ...precios] : conSeleccion}
        filas={filas}
        vacio="No hay unidades con esos filtros."
      />
      {ubicaciones && elegidas.length > 0 && (
        <div
          role="region"
          aria-label="Motos seleccionadas"
          className="sticky bottom-4 z-10 mx-auto mt-4 flex w-fit max-w-full flex-wrap items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg"
        >
          <span className="text-sm font-medium">
            {elegidas.length} {elegidas.length === 1 ? 'moto seleccionada' : 'motos seleccionadas'}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSeleccion(new Set())}>
            Quitar selección
          </Button>
          <Button size="sm" onClick={() => setMoviendo(elegidas)}>
            <MoveRight className="size-4" aria-hidden /> Mover a… ({elegidas.length})
          </Button>
        </div>
      )}
      {ubicaciones && moviendo && (
        <DialogoMover
          vehicleIds={moviendo}
          ubicaciones={ubicaciones}
          onCerrar={(movidas) => {
            setMoviendo(null);
            if (movidas) setSeleccion(new Set());
          }}
        />
      )}
    </>
  );
}
