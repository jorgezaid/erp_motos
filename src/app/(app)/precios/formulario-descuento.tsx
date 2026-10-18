'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { CampoTexto } from '@/components/formulario/campo';
import { Button } from '@/components/ui/button';
import { esquemaDescuentoMaximo, type EntradaDescuentoMaximo } from '@/lib/esquemas/precios';
import { avisar } from '@/lib/toast';
import { guardarDescuentoMaximo } from './acciones';

/** RN-25: descuento máximo por moto del vendedor. No cambia ningún precio de la lista. */
export function FormularioDescuento({ inicial }: { inicial: EntradaDescuentoMaximo }) {
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(esquemaDescuentoMaximo), defaultValues: inicial });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      if (avisar(await guardarDescuentoMaximo(valores), 'Descuento máximo del vendedor guardado')) reset(valores);
    });
  });

  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_auto] sm:items-end" noValidate>
      <CampoTexto
        etiqueta="Descuento máximo del vendedor (%)"
        inputMode="decimal"
        registro={register('porcentaje')}
        error={errors.porcentaje?.message}
      />
      <Button type="submit" disabled={pendiente || !isDirty}>
        {pendiente ? 'Guardando…' : 'Guardar descuento'}
      </Button>
    </form>
  );
}
