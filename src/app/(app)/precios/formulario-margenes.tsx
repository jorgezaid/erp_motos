'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { CampoTexto } from '@/components/formulario/campo';
import { Button } from '@/components/ui/button';
import { esquemaMargenes, type EntradaMargenes } from '@/lib/esquemas/precios';
import { avisar } from '@/lib/toast';
import { guardarMargenes } from './acciones';

/** Márgenes globales (SPEC §8). Al guardar, la BD regenera los precios de los lotes liquidados (RN-09). */
export function FormularioMargenes({ inicial }: { inicial: EntradaMargenes }) {
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(esquemaMargenes), defaultValues: inicial });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      if (avisar(await guardarMargenes(valores), 'Márgenes guardados: precios recalculados (los manuales se conservan)')) {
        reset(valores);
      }
    });
  });

  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-[repeat(3,minmax(0,10rem))_auto] sm:items-end" noValidate>
      <CampoTexto etiqueta="Margen x1 (%)" inputMode="decimal" registro={register('unidad_x1')} error={errors.unidad_x1?.message} />
      <CampoTexto etiqueta="Margen x3 (%)" inputMode="decimal" registro={register('mayorista_x3')} error={errors.mayorista_x3?.message} />
      <CampoTexto etiqueta="Margen x6 (%)" inputMode="decimal" registro={register('distribuidor_x6')} error={errors.distribuidor_x6?.message} />
      <Button type="submit" disabled={pendiente || !isDirty}>
        {pendiente ? 'Guardando…' : 'Guardar márgenes'}
      </Button>
    </form>
  );
}
