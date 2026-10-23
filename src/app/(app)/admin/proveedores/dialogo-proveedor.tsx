'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Campo, CampoTexto } from '@/components/formulario/campo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { esquemaProveedor, PROVEEDOR_VACIO, type EntradaProveedor } from '@/lib/esquemas/proveedor';
import { avisar } from '@/lib/toast';
import { guardarProveedor } from './acciones';

export function DialogoProveedor({
  id = null,
  inicial = PROVEEDOR_VACIO,
  disparador,
}: {
  id?: string | null;
  inicial?: EntradaProveedor;
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
  } = useForm({ resolver: zodResolver(esquemaProveedor), defaultValues: inicial });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      if (avisar(await guardarProveedor(id, valores), id ? 'Proveedor actualizado' : 'Proveedor creado')) {
        setAbierto(false);
        if (!id) reset(PROVEEDOR_VACIO);
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
          <DialogTitle>{id ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          <CampoTexto etiqueta="Nombre" registro={register('nombre')} error={errors.nombre?.message} placeholder="Luna Importaciones" />
          <CampoTexto etiqueta="RUC (opcional)" registro={register('ruc')} error={errors.ruc?.message} inputMode="numeric" />
          <CampoTexto etiqueta="Teléfono (opcional)" registro={register('telefono')} error={errors.telefono?.message} type="tel" />
          <Campo id="proveedor-activo" etiqueta="Activo">
            <Controller
              control={control}
              name="activo"
              render={({ field }) => <Switch id="proveedor-activo" checked={field.value} onCheckedChange={field.onChange} />}
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
