'use client';

import { Paperclip } from 'lucide-react';
import { BotonConfirmar } from '@/components/confirmar';
import { Button } from '@/components/ui/button';
import { Decimal } from '@/lib/decimal';
import type { EntradaGasto } from '@/lib/esquemas/gasto';
import { formatPEN } from '@/lib/format';
import { avisar } from '@/lib/toast';
import type { Database } from '@/types/database';
import { borrarGasto } from './acciones';
import { DialogoGasto } from './dialogo-gasto';
import { DialogoRealizado } from './dialogo-realizado';

export type FilaGasto = Database['public']['Tables']['gastos']['Row'];

function aEntrada(g: FilaGasto): EntradaGasto {
  return {
    estado: g.estado,
    fecha: g.fecha ?? '',
    fecha_estimada: g.fecha_estimada ?? '',
    categoria: g.categoria,
    descripcion: g.descripcion,
    proveedor: g.proveedor ?? '',
    monto_pen: new Decimal(g.monto_pen).toFixed(2),
    metodo_pago: g.metodo_pago === 'mixto' || g.metodo_pago === null ? '' : g.metodo_pago,
  };
}

/** Enlace al comprobante (abre una URL firmada, RN-24). */
export function EnlaceComprobante({ gasto }: { gasto: FilaGasto }) {
  if (!gasto.comprobante_path) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={`/gastos/${gasto.id}/comprobante`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm hover:underline"
      aria-label={`Ver comprobante: ${gasto.descripcion}`}
    >
      <Paperclip className="size-4" aria-hidden />
      Ver
    </a>
  );
}

/** Acciones de una fila: marcar como realizado (si está planificado), editar y borrar. */
export function AccionesGasto({ gasto, hoy }: { gasto: FilaGasto; hoy: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {gasto.estado === 'planificado' && (
        <DialogoRealizado
          id={gasto.id}
          descripcion={gasto.descripcion}
          montoEstimado={new Decimal(gasto.monto_pen).toFixed(2)}
          metodo={gasto.metodo_pago === 'mixto' ? null : gasto.metodo_pago}
          hoy={hoy}
        />
      )}
      <DialogoGasto
        id={gasto.id}
        inicial={aEntrada(gasto)}
        hoy={hoy}
        tieneComprobante={!!gasto.comprobante_path}
        disparador={
          <Button variant="outline" size="sm" aria-label={`Editar ${gasto.descripcion}`}>
            Editar
          </Button>
        }
      />
      <BotonConfirmar
        etiqueta="Borrar"
        tamano="sm"
        variante="outline"
        titulo="¿Borrar este gasto?"
        descripcion={
          <>
            Se borrará «{gasto.descripcion}» ({formatPEN(gasto.monto_pen)})
            {gasto.comprobante_path ? ' y su comprobante' : ''}. No se puede deshacer.
          </>
        }
        confirmar="Borrar"
        alConfirmar={async () => avisar(await borrarGasto(gasto.id), 'Gasto borrado')}
      />
    </div>
  );
}
