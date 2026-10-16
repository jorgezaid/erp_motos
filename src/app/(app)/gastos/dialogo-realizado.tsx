'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { CampoSelect } from '@/components/formulario/campo-select';
import { CampoTexto } from '@/components/formulario/campo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { METODO_PAGO_GASTO, opciones } from '@/lib/etiquetas';
import { esquemaRealizado, type EntradaRealizado } from '@/lib/esquemas/gasto';
import { formatPEN } from '@/lib/format';
import { avisar } from '@/lib/toast';
import { marcarRealizado } from './acciones';

/** RN-21: "Marcar como realizado" pide el monto real, la fecha del pago y el método. */
export function DialogoRealizado({
  id,
  descripcion,
  montoEstimado,
  metodo,
  hoy,
}: {
  id: string;
  descripcion: string;
  /** Monto planificado, como texto con 2 decimales */
  montoEstimado: string;
  metodo: EntradaRealizado['metodo_pago'] | null;
  hoy: string;
}) {
  const inicial = { monto_pen: montoEstimado, fecha: hoy, metodo_pago: metodo ?? '' } as EntradaRealizado;
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquemaRealizado), defaultValues: inicial });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      if (avisar(await marcarRealizado(id, valores), 'Gasto marcado como realizado')) setAbierto(false);
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
      <DialogTrigger asChild>
        <Button size="sm" aria-label={`Marcar como realizado: ${descripcion}`}>
          Marcar como realizado
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como realizado</DialogTitle>
          <DialogDescription>
            {descripcion} · estimado {formatPEN(montoEstimado)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          <CampoTexto
            etiqueta="Monto real (S/)"
            inputMode="decimal"
            registro={register('monto_pen')}
            error={errors.monto_pen?.message}
          />
          <CampoTexto etiqueta="Fecha de pago" type="date" registro={register('fecha')} error={errors.fecha?.message} />
          <CampoSelect
            control={control}
            nombre="metodo_pago"
            etiqueta="Método de pago"
            opciones={opciones(METODO_PAGO_GASTO)}
            error={errors.metodo_pago?.message}
          />
          <DialogFooter>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? 'Guardando…' : 'Marcar como realizado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
