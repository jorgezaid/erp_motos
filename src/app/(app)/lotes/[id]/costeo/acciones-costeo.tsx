'use client';

import { useTransition } from 'react';
import { BotonConfirmar } from '@/components/confirmar';
import { Button } from '@/components/ui/button';
import { avisar } from '@/lib/toast';
import { guardarCosteo, liquidarLote, reabrirLote } from '../acciones';

export function BotonGuardarCosteo({ batchId, deshabilitado }: { batchId: string; deshabilitado: boolean }) {
  const [pendiente, startTransition] = useTransition();
  return (
    <Button
      disabled={deshabilitado || pendiente}
      onClick={() => startTransition(async () => void avisar(await guardarCosteo(batchId), 'Costeo guardado'))}
    >
      {pendiente ? 'Guardando…' : 'Guardar costeo'}
    </Button>
  );
}

export function BotonLiquidar({ batchId, codigo, deshabilitado }: { batchId: string; codigo: string; deshabilitado: boolean }) {
  return (
    <BotonConfirmar
      etiqueta="Liquidar lote"
      deshabilitado={deshabilitado}
      titulo={`¿Liquidar el lote ${codigo}?`}
      descripcion={
        <>
          <p>Se congelan los costos y el packing list, y se genera la lista de precios x1/x3/x6 (RN-07, RN-09).</p>
          <p className="mt-2">Solo podrás reabrirlo si ninguna unidad está reservada o vendida.</p>
        </>
      }
      confirmar="Liquidar"
      alConfirmar={async () => avisar(await liquidarLote(batchId), `Lote ${codigo} liquidado: precios generados`)}
    />
  );
}

export function BotonReabrir({ batchId, codigo }: { batchId: string; codigo: string }) {
  return (
    <BotonConfirmar
      etiqueta="Reabrir lote"
      variante="outline"
      titulo={`¿Reabrir el lote ${codigo}?`}
      descripcion="Vuelve a «En almacén» para editar costos y packing list. Los precios ya generados se conservan hasta que lo liquides de nuevo (RN-08)."
      confirmar="Reabrir"
      alConfirmar={async () => avisar(await reabrirLote(batchId), `Lote ${codigo} reabierto`)}
    />
  );
}
