'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { CampoSelect } from '@/components/formulario/campo-select';
import { CampoArea, CampoTexto } from '@/components/formulario/campo';
import { Button } from '@/components/ui/button';
import { ESTADO_LOTE } from '@/lib/etiquetas';
import { ESTADOS_LOTE_EDITABLES, esquemaDatosLote, type EntradaDatosLote } from '@/lib/esquemas/lote';
import { avisar } from '@/lib/toast';
import { guardarDatosLote } from './acciones';

const OPCIONES_ESTADO = ESTADOS_LOTE_EDITABLES.map((e) => ({ valor: e, etiqueta: ESTADO_LOTE[e] }));

export function FormularioDatos({ id, inicial, liquidado }: { id: string; inicial: EntradaDatosLote; liquidado: boolean }) {
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    // Liquidado: solo se editan las notas, sin validar el resto
    resolver: liquidado ? undefined : zodResolver(esquemaDatosLote),
    defaultValues: inicial,
  });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      avisar(await guardarDatosLote(id, valores), 'Datos del lote guardados');
    });
  });

  return (
    <form onSubmit={enviar} className="grid max-w-3xl gap-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto etiqueta="Código de embarque" registro={register('codigo_embarque')} error={errors.codigo_embarque?.message} disabled={liquidado} />
        <CampoTexto etiqueta="N.º de DAM" registro={register('nro_dam')} error={errors.nro_dam?.message} disabled={liquidado} placeholder="118-2026-10-361056-01-0-00" />
        <CampoTexto etiqueta="Proveedor" registro={register('proveedor')} error={errors.proveedor?.message} disabled={liquidado} />
        {liquidado ? (
          <CampoTexto etiqueta="Estado" registro={register('estado')} disabled />
        ) : (
          <CampoSelect control={control} nombre="estado" etiqueta="Estado" opciones={OPCIONES_ESTADO} error={errors.estado?.message} ayuda="Para liquidar, usa la pestaña Costeo." />
        )}
        <CampoTexto etiqueta="Fecha de embarque" type="date" registro={register('fecha_embarque')} error={errors.fecha_embarque?.message} disabled={liquidado} />
        <CampoTexto etiqueta="Fecha de llegada" type="date" registro={register('fecha_llegada')} error={errors.fecha_llegada?.message} disabled={liquidado} />
      </div>
      <CampoArea etiqueta="Notas" registro={register('notas')} error={errors.notas?.message} ayuda={liquidado ? 'En un lote liquidado solo se pueden editar las notas (RN-08).' : undefined} />
      <div>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? 'Guardando…' : liquidado ? 'Guardar notas' : 'Guardar datos'}
        </Button>
      </div>
    </form>
  );
}
