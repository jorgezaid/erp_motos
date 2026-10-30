'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { CampoTexto } from '@/components/formulario/campo';
import { Button } from '@/components/ui/button';
import { esquemaAjustesVenta, type EntradaAjustesVenta } from '@/lib/esquemas/precios';
import { avisar } from '@/lib/toast';
import { guardarAjustesVenta } from './acciones';

/** RN-25: descuento máximo por moto del vendedor; D43: tope sobre la lista. No cambia ningún precio de la lista. */
export function FormularioAjustesVenta({ inicial }: { inicial: EntradaAjustesVenta }) {
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(esquemaAjustesVenta), defaultValues: inicial });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      if (avisar(await guardarAjustesVenta(valores), 'Ajustes de precio guardados')) reset(valores);
    });
  });

  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,14rem)_auto] sm:items-end" noValidate>
      <CampoTexto
        etiqueta="Descuento máximo del vendedor (%)"
        inputMode="decimal"
        registro={register('porcentaje')}
        error={errors.porcentaje?.message}
      />
      <CampoTexto
        etiqueta="Aumento máximo sobre la lista (%)"
        inputMode="decimal"
        registro={register('aumento')}
        error={errors.aumento?.message}
      />
      <Button type="submit" disabled={pendiente || !isDirty}>
        {pendiente ? 'Guardando…' : 'Guardar ajustes'}
      </Button>
    </form>
  );
}
