'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { EstadoReclamo } from '@/components/estado-badge';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { Badge } from '@/components/ui/badge';
import { COBERTURA } from '@/lib/etiquetas';
import { formatFecha, formatFechaHora, formatPEN } from '@/lib/format';
import { textoVigencia } from '@/lib/garantias';
import { cn } from '@/lib/utils';
import type { FilaGarantia, FilaReclamo } from './datos';
import { DialogoAtender, DialogoReclamo } from './dialogos';

const columnasGarantias: ColumnDef<FilaGarantia, unknown>[] = [
  { accessorKey: 'vin_chasis', header: 'VIN', cell: ({ row }) => <span className="font-mono">{row.original.vin_chasis}</span> },
  { accessorKey: 'codigo_modelo', header: 'Modelo' },
  { accessorKey: 'cliente_nombre', header: 'Cliente' },
  { accessorKey: 'cliente_documento', header: 'Documento' },
  { accessorKey: 'orden_numero', header: 'Venta', cell: ({ row }) => `#${row.original.orden_numero}` },
  { accessorKey: 'cobertura', header: 'Cobertura', cell: ({ row }) => (row.original.cobertura ? COBERTURA[row.original.cobertura] : '—') },
  {
    accessorKey: 'fecha_fin',
    header: 'Vigencia',
    cell: ({ row }) => `${formatFecha(row.original.fecha_inicio)} – ${formatFecha(row.original.fecha_fin)}`,
  },
  {
    id: 'estado',
    header: 'Estado',
    cell: ({ row }) => (
      <Badge
        className={cn(
          'border-transparent',
          row.original.vigente
            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
            : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
        )}
      >
        {textoVigencia(row.original)}
      </Badge>
    ),
  },
  {
    id: 'acciones',
    header: '',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.vigente && row.original.id ? (
        <DialogoReclamo
          warrantyId={row.original.id}
          vin={row.original.vin_chasis ?? ''}
          cobertura={row.original.cobertura ? COBERTURA[row.original.cobertura].toLowerCase() : ''}
        />
      ) : null,
  },
];

export function TablaGarantias({ filas }: { filas: FilaGarantia[] }) {
  return <TablaDatos columnas={columnasGarantias} filas={filas} vacio="No se encontraron garantías." />;
}

export function TablaReclamos({ filas, puedeAtender }: { filas: FilaReclamo[]; puedeAtender: boolean }) {
  const columnas: ColumnDef<FilaReclamo, unknown>[] = [
    { accessorKey: 'creado', header: 'Fecha', cell: ({ row }) => formatFechaHora(row.original.creado) },
    { accessorKey: 'vin', header: 'VIN', cell: ({ row }) => <span className="font-mono">{row.original.vin}</span> },
    { accessorKey: 'cliente', header: 'Cliente' },
    { accessorKey: 'cobertura', header: 'Cobertura', cell: ({ row }) => COBERTURA[row.original.cobertura] },
    { accessorKey: 'descripcion', header: 'Problema', cell: ({ row }) => <span className="whitespace-normal">{row.original.descripcion}</span> },
    { accessorKey: 'diagnostico', header: 'Diagnóstico', cell: ({ row }) => <span className="whitespace-normal">{row.original.diagnostico ?? '—'}</span> },
    { accessorKey: 'estado', header: 'Estado', cell: ({ row }) => <EstadoReclamo estado={row.original.estado} /> },
    { accessorKey: 'tecnico', header: 'Técnico', cell: ({ row }) => row.original.tecnico ?? '—' },
    { accessorKey: 'costo', header: 'Costo', meta: { className: 'text-right' }, cell: ({ row }) => formatPEN(row.original.costo) },
    ...(puedeAtender
      ? [
          {
            id: 'acciones',
            header: '',
            enableSorting: false,
            cell: ({ row }: { row: { original: FilaReclamo } }) =>
              row.original.estado === 'cerrado' ? null : (
                <DialogoAtender
                  claimId={row.original.id}
                  vin={row.original.vin}
                  estado={row.original.estado}
                  diagnostico={row.original.diagnostico}
                  costo={row.original.costo}
                />
              ),
          } satisfies ColumnDef<FilaReclamo, unknown>,
        ]
      : []),
  ];
  return <TablaDatos columnas={columnas} filas={filas} vacio="No hay reclamos con ese estado." />;
}
