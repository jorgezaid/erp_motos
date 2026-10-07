'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { CampoSelect } from '@/components/formulario/campo-select';
import { Campo, CampoTexto } from '@/components/formulario/campo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { opciones, TIPO_UBICACION } from '@/lib/etiquetas';
import { esquemaUbicacion, UBICACION_VACIA, type EntradaUbicacion } from '@/lib/esquemas/ubicacion';
import { avisar } from '@/lib/toast';
import { guardarUbicacion } from './acciones';

export function DialogoUbicacion({
  id = null,
  inicial = UBICACION_VACIA,
  disparador,
}: {
  id?: string | null;
  inicial?: EntradaUbicacion;
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
  } = useForm({ resolver: zodResolver(esquemaUbicacion), defaultValues: inicial });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      if (avisar(await guardarUbicacion(id, valores), id ? 'Ubicación actualizada' : 'Ubicación creada')) {
        setAbierto(false);
        if (!id) reset(UBICACION_VACIA);
      }
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
          <DialogTitle>{id ? 'Editar ubicación' : 'Nueva ubicación'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          <CampoTexto etiqueta="Nombre" registro={register('nombre')} error={errors.nombre?.message} />
          <CampoSelect control={control} nombre="tipo" etiqueta="Tipo" opciones={opciones(TIPO_UBICACION)} error={errors.tipo?.message} />
          <CampoTexto etiqueta="Dirección" registro={register('direccion')} error={errors.direccion?.message} />
          <Campo id="ubicacion-activa" etiqueta="Activa">
            <Controller
              control={control}
              name="activo"
              render={({ field }) => <Switch id="ubicacion-activa" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </Campo>
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
