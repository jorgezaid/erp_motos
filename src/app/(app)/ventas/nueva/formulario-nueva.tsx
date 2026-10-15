'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm, useWatch, type Control, type UseFormRegister } from 'react-hook-form';
import { RadioOpciones } from '@/components/formulario/radio-opciones';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { mostrarSelectorEscala } from '@/lib/escalas';
import { TIPO_VENTA } from '@/lib/etiquetas';
import { avisar } from '@/lib/toast';
import { esquemaNuevaVenta, type EntradaCliente, type EntradaNuevaVenta } from '@/lib/ventas';
import { crearOrden } from '../acciones';
import { CamposCliente } from '../campos-cliente';

type TipoVenta = EntradaNuevaVenta['tipo_venta'];

export function FormularioNuevaVenta({ activas, minimos }: { activas: TipoVenta[]; minimos: Record<TipoVenta, number> }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaNuevaVenta),
    defaultValues: {
      tipo_venta: activas[0] ?? 'unidad_x1',
      cliente_nombre: '',
      cliente_tipo_documento: 'DNI',
      cliente_documento: '',
      cliente_telefono: '',
      cliente_email: '',
    } satisfies EntradaNuevaVenta,
  });
  const tipo = useWatch({ control, name: 'tipo_venta' });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      const r = await crearOrden(valores);
      if (avisar(r, 'Orden creada: agrega las unidades')) router.push(`/ventas/${r.datos.id}`);
    });
  });

  return (
    <form onSubmit={enviar} className="grid max-w-3xl gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>1. Tipo de venta</CardTitle>
          <CardDescription>
            {mostrarSelectorEscala(activas)
              ? 'Define la escala de precios. Se puede cambiar mientras la orden esté en borrador.'
              : 'Es la única escala de venta activa.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mostrarSelectorEscala(activas) ? (
            <RadioOpciones
              nombre="tipo_venta"
              valor={tipo}
              alCambiar={(v) => setValue('tipo_venta', v as TipoVenta)}
              opciones={activas.map((t) => ({
                valor: t,
                etiqueta: TIPO_VENTA[t],
                descripcion: `Desde ${minimos[t]} unidad(es)`,
              }))}
            />
          ) : (
            <p className="text-sm font-medium" data-testid="escala-unica">
              {TIPO_VENTA[tipo]}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Cliente</CardTitle>
          <CardDescription>DNI de 8 dígitos, RUC de 11 (empieza por 10, 15, 17 o 20) o carné de extranjería.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Los campos del cliente son un subconjunto de los de este formulario */}
          <CamposCliente
            register={register as unknown as UseFormRegister<EntradaCliente>}
            control={control as unknown as Control<EntradaCliente>}
            errors={errors}
          />
        </CardContent>
      </Card>

      <div>
        <Button type="submit" size="lg" disabled={pendiente}>
          {pendiente ? 'Creando…' : 'Crear orden y agregar unidades'}
        </Button>
      </div>
    </form>
  );
}
