'use client';

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Tabla con TanStack Table (SPEC §4). Ordena la página actual en el cliente; la búsqueda,
 * los filtros y la paginación los hace el servidor.
 * `meta.className` en una columna se aplica a sus celdas (p. ej. `text-right` para montos).
 */
export function TablaDatos<F>({
  columnas,
  filas,
  vacio = 'No hay registros.',
  claseFila,
}: {
  columnas: ColumnDef<F, unknown>[];
  filas: F[];
  vacio?: string;
  claseFila?: (fila: F) => string | undefined;
}) {
  const [orden, setOrden] = useState<SortingState>([]);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table devuelve funciones no memoizables
  const tabla = useReactTable({
    data: filas,
    columns: columnas,
    state: { sorting: orden },
    onSortingChange: setOrden,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          {tabla.getHeaderGroups().map((g) => (
            <TableRow key={g.id}>
              {g.headers.map((h) => {
                const clase = (h.column.columnDef.meta as { className?: string } | undefined)?.className;
                const ordenable = h.column.getCanSort();
                const sentido = h.column.getIsSorted();
                return (
                  <TableHead key={h.id} className={clase}>
                    {h.isPlaceholder ? null : ordenable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:underline"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sentido === 'asc' && <ArrowUp className="size-3" aria-label="ascendente" />}
                        {sentido === 'desc' && <ArrowDown className="size-3" aria-label="descendente" />}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {tabla.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnas.length} className="h-20 text-center text-muted-foreground">
                {vacio}
              </TableCell>
            </TableRow>
          ) : (
            tabla.getRowModel().rows.map((r) => (
              <TableRow key={r.id} className={claseFila?.(r.original)}>
                {r.getVisibleCells().map((c) => (
                  <TableCell
                    key={c.id}
                    className={cn((c.column.columnDef.meta as { className?: string } | undefined)?.className)}
                  >
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
