'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { CampoSelect } from '@/components/formulario/campo-select';
import { Campo, CampoTexto } from '@/components/formulario/campo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CATEGORIA, opciones } from '@/lib/etiquetas';
import { esquemaModelo, textoBaterias, VOLTAJES, type EntradaModelo } from '@/lib/esquemas/modelo';
import { avisar } from '@/lib/toast';
import { actualizarModelo, crearModelo } from './acciones';

const OPCIONES_VOLTAJE = VOLTAJES.map((v) => ({ valor: String(v), etiqueta: `${v}V` }));

export function FormularioModelo({ id, inicial }: { id?: string; inicial: EntradaModelo }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquemaModelo), defaultValues: inicial });
  const voltaje = useWatch({ control, name: 'voltaje_sistema' });

  const enviar = handleSubmit(() => {
    // Se envía la entrada cruda (texto): la Server Action vuelve a validar con el mismo esquema
    const valores = getValues();
    startTransition(async () => {
      const r = id ? await actualizarModelo(id, valores) : await crearModelo(valores);
      if (!r.ok && r.campos) {
        for (const [k, msg] of Object.entries(r.campos)) setError(k as keyof EntradaModelo, { message: msg });
      }
      if (avisar(r, id ? 'Modelo actualizado' : 'Modelo creado')) {
        router.push('/admin/modelos');
        router.refresh();
      }
    });
  });

  return (
    <form onSubmit={enviar} className="grid max-w-3xl gap-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto etiqueta="Código de modelo" registro={register('codigo_modelo')} error={errors.codigo_modelo?.message} placeholder="XSDU-29" />
        <CampoTexto etiqueta="Nombre comercial" registro={register('nombre_comercial')} error={errors.nombre_comercial?.message} />
        <CampoSelect control={control} nombre="categoria" etiqueta="Categoría" opciones={opciones(CATEGORIA)} error={errors.categoria?.message} />
        <CampoSelect
          control={control}
          nombre="voltaje_sistema"
          etiqueta="Voltaje del sistema"
          opciones={OPCIONES_VOLTAJE}
          error={errors.voltaje_sistema?.message}
        />
        <Campo id="baterias" etiqueta="Baterías (derivadas del voltaje)">
          <Input id="baterias" readOnly value={textoBaterias(Number(voltaje))} aria-readonly className="bg-muted" />
        </Campo>
        <CampoTexto etiqueta="Amperaje de batería (Ah)" inputMode="numeric" registro={register('amperaje_bateria_ah')} error={errors.amperaje_bateria_ah?.message} />
        <CampoTexto etiqueta="Potencia del motor (W)" inputMode="numeric" registro={register('potencia_motor_watts')} error={errors.potencia_motor_watts?.message} />
        <CampoTexto etiqueta="Volumen unitario (CBM)" inputMode="decimal" registro={register('volumen_cbm_unitario')} error={errors.volumen_cbm_unitario?.message} />
        <CampoTexto etiqueta="EXW unitario (US$)" inputMode="decimal" registro={register('exw_usd_unitario')} error={errors.exw_usd_unitario?.message} ayuda="Precio referencial; en cada lote se puede ajustar." />
        <CampoTexto etiqueta="Garantía general (meses)" inputMode="numeric" registro={register('garantia_meses')} error={errors.garantia_meses?.message} />
        <CampoTexto etiqueta="Garantía de baterías (meses)" inputMode="numeric" registro={register('garantia_baterias_meses')} error={errors.garantia_baterias_meses?.message} />
        <Campo id="activo" etiqueta="Activo">
          <Controller
            control={control}
            name="activo"
            render={({ field }) => <Switch id="activo" checked={field.value} onCheckedChange={field.onChange} />}
          />
        </Campo>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/modelos')}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
