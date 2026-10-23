'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { CampoTexto } from '@/components/formulario/campo';
import { CampoSelect } from '@/components/formulario/campo-select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { esquemaItemCompraLocal, type EntradaItemCompraLocal } from '@/lib/esquemas/compra-local';
import { avisar } from '@/lib/toast';
import { guardarItemCompraLocal } from '../acciones';

const VACIO: EntradaItemCompraLocal = { model_id: '', cantidad_packing_list: '', precio_compra_unitario_pen: '' };

/** Alta o edición de un ítem de una compra local (D41): modelo, cantidad y precio unitario de la factura. */
export function DialogoItem({
  batchId,
  itemId,
  inicial = VACIO,
  modelos = [],
  codigo,
  incluyeIgv,
  disparador,
}: {
  batchId: string;
  itemId?: string;
  inicial?: EntradaItemCompraLocal;
  /** Modelos disponibles para agregar (solo en alta) */
  modelos?: { id: string; codigo_modelo: string }[];
  /** Código del modelo (solo en edición) */
  codigo?: string;
  incluyeIgv: boolean;
  disparador: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquemaItemCompraLocal), defaultValues: inicial });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      const r = await guardarItemCompraLocal(batchId, itemId ?? null, valores);
      if (avisar(r, itemId ? 'Ítem actualizado' : 'Modelo agregado a la compra')) setAbierto(false);
    });
  });

  return (
    <Dialog
      open={abierto}
      onOpenChange={(a) => {
        setAbierto(a);
        if (a) reset(inicial);
      }}
    >
      <DialogTrigger asChild>{disparador}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{itemId ? `Editar ${codigo}` : 'Agregar modelo a la compra'}</DialogTitle>
          <DialogDescription>
            Precio unitario de la factura, {incluyeIgv ? 'con IGV incluido' : 'sin IGV'} (se cambia en la pestaña Costos).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          {!itemId && (
            <CampoSelect
              control={control}
              nombre="model_id"
              etiqueta="Modelo"
              opciones={modelos.map((m) => ({ valor: m.id, etiqueta: m.codigo_modelo }))}
              error={errors.model_id?.message}
              placeholder="Elige un modelo"
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              etiqueta="Cantidad"
              inputMode="numeric"
              registro={register('cantidad_packing_list')}
              error={errors.cantidad_packing_list?.message}
            />
            <CampoTexto
              etiqueta="Precio unitario (S/)"
              inputMode="decimal"
              registro={register('precio_compra_unitario_pen')}
              error={errors.precio_compra_unitario_pen?.message}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
