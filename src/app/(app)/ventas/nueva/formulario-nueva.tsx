'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useForm, useWatch, type Control, type UseFormRegister } from 'react-hook-form';
import { RadioOpciones } from '@/components/formulario/radio-opciones';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { mostrarSelectorEscala } from '@/lib/escalas';
import { TIPO_VENTA } from '@/lib/etiquetas';
import { avisar } from '@/lib/toast';
import {
  documentoValido,
  esquemaNuevaVenta,
  motosReservadas,
  normalizarDocumento,
  type ClienteConocido,
  type EntradaCliente,
  type EntradaNuevaVenta,
} from '@/lib/ventas';
import { buscarCliente, crearOrden } from '../acciones';
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
  const tipoDocumento = useWatch({ control, name: 'cliente_tipo_documento' });
  const documento = normalizarDocumento(useWatch({ control, name: 'cliente_documento' }));
  const consultable = documentoValido(tipoDocumento, documento);
  const [conocido, setConocido] = useState<{ clave: string; cliente: ClienteConocido } | null>(null);
  const cliente = consultable && conocido?.clave === `${tipoDocumento}:${documento}` ? conocido.cliente : null;

  // Con un documento válido, busca borradores y ventas anteriores del cliente; autocompleta solo
  // los campos vacíos para no pisar lo que el vendedor ya escribió.
  useEffect(() => {
    if (!consultable) return;
    let vigente = true;
    const t = setTimeout(async () => {
      const r = await buscarCliente(tipoDocumento, documento);
      if (!vigente || !r.ok) return;
      setConocido({ clave: `${tipoDocumento}:${documento}`, cliente: r.datos });
      const d = r.datos.datos;
      if (!d) return;
      const campos = [
        ['cliente_nombre', d.nombre],
        ['cliente_telefono', d.telefono],
        ['cliente_email', d.email],
      ] as const;
      for (const [campo, valor] of campos) {
        if (valor && !getValues(campo).trim()) setValue(campo, valor, { shouldValidate: true });
      }
    }, 350);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [consultable, tipoDocumento, documento, getValues, setValue]);

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
          {cliente?.borrador && (
            <Alert className="mt-4" data-testid="borrador-cliente">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {cliente.borrador.puedeContinuar
                    ? `Este cliente tiene la orden #${cliente.borrador.numero} en borrador`
                    : `La orden #${cliente.borrador.numero} de este cliente está en borrador (vendedor: ${cliente.borrador.vendedor})`}{' '}
                  · creada {cliente.borrador.antiguedad} · {motosReservadas(cliente.borrador.motos)}.
                </span>
                {cliente.borrador.puedeContinuar && (
                  <Button asChild size="sm">
                    <Link href={`/ventas/${cliente.borrador.id}`}>Continuar esa orden</Link>
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          {cliente?.datos && (
            <p className="mt-3 text-sm text-muted-foreground" data-testid="datos-cliente">
              Datos tomados de la venta #{cliente.datos.numero}: revisa que sigan vigentes.
            </p>
          )}
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
