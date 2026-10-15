'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import { useState, useTransition } from 'react';
import { TablaDatos } from '@/components/tabla/tabla-datos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Decimal } from '@/lib/decimal';
import { TIPOS_VENTA } from '@/lib/escalas';
import { formatPEN } from '@/lib/format';
import { avisar } from '@/lib/toast';
import type { TipoVenta } from '@/lib/ventas';
import { guardarPrecioManual } from './acciones';
import type { FilaPrecioAdmin } from './datos';

const CORTO: Record<TipoVenta, string> = { unidad_x1: 'x1', mayorista_x3: 'x3', distribuidor_x6: 'x6' };

/** Precio de una escala con edición inline del precio manual (SPEC M5). */
function CeldaPrecio({ fila, tipo }: { fila: FilaPrecioAdmin; tipo: TipoVenta }) {
  const p = fila.precios[tipo];
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [pendiente, startTransition] = useTransition();
  if (!p) return <span className="text-muted-foreground">—</span>;
  const nombre = `precio ${CORTO[tipo]} de ${fila.codigo_modelo} (${fila.codigo_embarque})`;
  const utilidad = fila.costo === null ? null : new Decimal(p.venta).minus(fila.costo).toFixed(2);

  function guardar(precio: string) {
    startTransition(async () => {
      const r = await guardarPrecioManual({ batchId: fila.batch_id, modelId: fila.model_id, tipoVenta: tipo, precio });
      if (avisar(r, precio ? 'Precio manual guardado' : 'Se usará el precio sugerido')) setEditando(false);
    });
  }

  if (editando) {
    return (
      <form
        className="flex items-center justify-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          guardar(valor);
        }}
      >
        <Input
          autoFocus
          aria-label={`Nuevo ${nombre}`}
          value={valor}
          inputMode="decimal"
          onChange={(e) => setValor(e.target.value)}
          className="h-8 w-28 text-right"
          placeholder={String(p.sugerido)}
        />
        <Button type="submit" size="sm" disabled={pendiente}>
          OK
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)}>
          ✕
        </Button>
      </form>
    );
  }

  return (
    <div className="grid justify-items-end gap-0.5">
      <span className="inline-flex items-center gap-1">
        {p.manual !== null && (
          <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
            manual
          </Badge>
        )}
        <span className="font-medium">{formatPEN(p.venta)}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={`Editar ${nombre}`}
          onClick={() => {
            setValor(p.manual === null ? '' : String(p.manual));
            setEditando(true);
          }}
        >
          <Pencil className="size-3" />
        </Button>
      </span>
      {p.manual !== null && <span className="text-xs text-muted-foreground">sugerido {formatPEN(p.sugerido)}</span>}
      <span className="text-xs text-muted-foreground">utilidad {formatPEN(utilidad)}</span>
    </div>
  );
}

const columnasFijas: ColumnDef<FilaPrecioAdmin, unknown>[] = [
  { accessorKey: 'codigo_modelo', header: 'Modelo', cell: ({ row }) => <span className="font-medium">{row.original.codigo_modelo}</span> },
  { accessorKey: 'codigo_embarque', header: 'Lote' },
  { accessorKey: 'disponibles', header: 'Disponibles', meta: { className: 'text-right' } },
  { accessorKey: 'costo', header: 'Costo unitario', meta: { className: 'text-right' }, cell: ({ row }) => formatPEN(row.original.costo) },
];

/** Escalas desactivadas (D31): la columna se atenúa y se rotula, pero sus precios se siguen editando. */
function columnaPrecio(tipo: TipoVenta, activa: boolean): ColumnDef<FilaPrecioAdmin, unknown> {
  return {
    id: tipo,
    header: () =>
      activa ? (
        CORTO[tipo]
      ) : (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          {CORTO[tipo]} <Badge variant="outline">Desactivada</Badge>
        </span>
      ),
    enableSorting: false,
    meta: { className: activa ? 'text-right' : 'text-right opacity-50' },
    cell: ({ row }) => <CeldaPrecio fila={row.original} tipo={tipo} />,
  };
}

export function TablaPreciosAdmin({ filas, activas }: { filas: FilaPrecioAdmin[]; activas: TipoVenta[] }) {
  const columnas = [...columnasFijas, ...TIPOS_VENTA.map((t) => columnaPrecio(t, activas.includes(t)))];
  return <TablaDatos columnas={columnas} filas={filas} vacio="Aún no hay precios: se generan al liquidar cada lote." />;
}
