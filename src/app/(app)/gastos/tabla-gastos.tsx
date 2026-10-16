'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { EstadoGasto } from '@/components/estado-badge';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { CATEGORIA_GASTO, METODO_PAGO } from '@/lib/etiquetas';
import { formatFecha, formatPEN } from '@/lib/format';
import { AccionesGasto, EnlaceComprobante, type FilaGasto } from './acciones-gasto';

function columnas(hoy: string): ColumnDef<FilaGasto, unknown>[] {
  return [
    {
      id: 'fecha',
      header: 'Fecha',
      accessorFn: (g) => g.fecha ?? g.fecha_estimada,
      cell: ({ row: { original: g } }) =>
        g.fecha ? (
          formatFecha(g.fecha)
        ) : (
          <span className="text-muted-foreground" title="Fecha estimada">
            {formatFecha(g.fecha_estimada)} (est.)
          </span>
        ),
    },
    { accessorKey: 'estado', header: 'Estado', cell: ({ row }) => <EstadoGasto estado={row.original.estado} /> },
    { accessorKey: 'categoria', header: 'Categoría', cell: ({ row }) => CATEGORIA_GASTO[row.original.categoria] },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row: { original: g } }) => (
        <div className="grid">
          <span className="font-medium">{g.descripcion}</span>
          {g.proveedor && <span className="text-xs text-muted-foreground">{g.proveedor}</span>}
        </div>
      ),
    },
    {
      accessorKey: 'monto_pen',
      header: 'Monto',
      meta: { className: 'text-right tabular-nums' },
      cell: ({ row }) => formatPEN(row.original.monto_pen),
    },
    {
      accessorKey: 'metodo_pago',
      header: 'Método',
      cell: ({ row }) => (row.original.metodo_pago ? METODO_PAGO[row.original.metodo_pago] : '—'),
    },
    {
      id: 'comprobante',
      header: 'Comprobante',
      enableSorting: false,
      cell: ({ row }) => <EnlaceComprobante gasto={row.original} />,
    },
    {
      id: 'acciones',
      header: '',
      enableSorting: false,
      meta: { className: 'text-right' },
      cell: ({ row }) => <AccionesGasto gasto={row.original} hoy={hoy} />,
    },
  ];
}

export function TablaGastos({ filas, hoy, vacio = 'No hay gastos con esos filtros.' }: { filas: FilaGasto[]; hoy: string; vacio?: string }) {
  const cols = useMemo(() => columnas(hoy), [hoy]);
  return <TablaDatos columnas={cols} filas={filas} vacio={vacio} />;
}
