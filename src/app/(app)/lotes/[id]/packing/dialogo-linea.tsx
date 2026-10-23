'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Campo, CampoTexto } from '@/components/formulario/campo';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { esquemaLineaPacking, type EntradaLineaPacking } from '@/lib/esquemas/lote';
import { avisar } from '@/lib/toast';
import { actualizarLinea, agregarLinea } from '../acciones';

export type ModeloCatalogo = { id: string; codigo_modelo: string; exw_usd_unitario: number | null; volumen_cbm_unitario: number | null };

const VACIA: EntradaLineaPacking = {
  model_id: '',
  cantidad_packing_list: '',
  cantidad_dam: '',
  exw_usd_unitario: '',
  volumen_cbm_unitario: '',
};

/** Alta (con selector de modelo que precarga EXW y CBM del catálogo) o edición de una línea. */
export function DialogoLinea({
  batchId,
  itemId,
  inicial = VACIA,
  modelos = [],
  codigo,
  disparador,
}: {
  batchId: string;
  itemId?: string;
  inicial?: EntradaLineaPacking;
  /** Modelos disponibles para agregar (solo en alta) */
  modelos?: ModeloCatalogo[];
  /** Código del modelo (solo en edición) */
  codigo?: string;
  disparador: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquemaLineaPacking), defaultValues: inicial });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      const r = itemId ? await actualizarLinea(batchId, itemId, valores) : await agregarLinea(batchId, valores);
      if (avisar(r, itemId ? 'Línea actualizada' : 'Modelo agregado al packing list')) setAbierto(false);
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
          <DialogTitle>{itemId ? `Editar ${codigo}` : 'Agregar modelo al packing list'}</DialogTitle>
          <DialogDescription>EXW y CBM se precargan del catálogo; ajústalos a la factura real si difieren.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          {!itemId && (
            <Campo id="linea-modelo" etiqueta="Modelo" error={errors.model_id?.message}>
              <Controller
                control={control}
                name="model_id"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      const m = modelos.find((x) => x.id === v);
                      if (m) {
                        setValue('exw_usd_unitario', m.exw_usd_unitario === null ? '' : String(m.exw_usd_unitario));
                        setValue('volumen_cbm_unitario', m.volumen_cbm_unitario === null ? '' : String(m.volumen_cbm_unitario));
                      }
                    }}
                  >
                    <SelectTrigger id="linea-modelo" className="w-full" aria-label="Modelo">
                      <SelectValue placeholder="Elige un modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelos.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.codigo_modelo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto etiqueta="Cantidad (packing list)" inputMode="numeric" registro={register('cantidad_packing_list')} error={errors.cantidad_packing_list?.message} />
            <CampoTexto etiqueta="Cantidad (DAM)" inputMode="numeric" registro={register('cantidad_dam')} error={errors.cantidad_dam?.message} ayuda="Opcional: lo declarado en aduanas." />
            <CampoTexto etiqueta="EXW unitario (US$)" inputMode="decimal" registro={register('exw_usd_unitario')} error={errors.exw_usd_unitario?.message} />
            <CampoTexto etiqueta="CBM unitario" inputMode="decimal" registro={register('volumen_cbm_unitario')} error={errors.volumen_cbm_unitario?.message} />
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
