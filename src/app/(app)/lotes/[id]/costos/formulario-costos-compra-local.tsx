'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { CampoTexto } from '@/components/formulario/campo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { esquemaCostosCompraLocal, type EntradaCostosCompraLocal } from '@/lib/esquemas/compra-local';
import { avisar } from '@/lib/toast';
import { guardarCostosCompraLocal } from '../acciones';

type Interruptor = 'precio_incluye_igv' | 'impuestos_recuperables_al_costo';
type Monto = Exclude<keyof EntradaCostosCompraLocal, Interruptor>;

function CampoInterruptor({
  control,
  nombre,
  etiqueta,
  ayuda,
  disabled,
}: {
  control: Control<EntradaCostosCompraLocal>;
  nombre: Interruptor;
  etiqueta: string;
  ayuda: string;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <Controller
        control={control}
        name={nombre}
        render={({ field }) => (
          <Switch
            id={nombre}
            checked={field.value}
            onCheckedChange={field.onChange}
            disabled={disabled}
            aria-describedby={`${nombre}-ayuda`}
          />
        )}
      />
      <div className="grid gap-1">
        <Label htmlFor={nombre}>{etiqueta}</Label>
        <p id={`${nombre}-ayuda`} className="text-xs text-muted-foreground">
          {ayuda}
        </p>
      </div>
    </div>
  );
}

/** Pestaña Costos de una compra local (D41): IGV, flete Lima → Arequipa, otros gastos y armado, en soles. */
export function FormularioCostosCompraLocal({
  id,
  inicial,
  liquidado,
  hayCosteo,
}: {
  id: string;
  inicial: EntradaCostosCompraLocal;
  liquidado: boolean;
  hayCosteo: boolean;
}) {
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors, isDirty },
  } = useForm<EntradaCostosCompraLocal>({ resolver: zodResolver(esquemaCostosCompraLocal), defaultValues: inicial });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      if (avisar(await guardarCostosCompraLocal(id, valores), 'Costos de la compra guardados')) reset(valores);
    });
  });

  const campo = (nombre: Monto, etiqueta: string, ayuda?: string) => (
    <CampoTexto
      etiqueta={etiqueta}
      inputMode="decimal"
      registro={register(nombre)}
      error={errors[nombre]?.message}
      ayuda={ayuda}
      disabled={liquidado}
    />
  );

  return (
    <form onSubmit={enviar} className="grid max-w-4xl gap-6" noValidate>
      {hayCosteo && !liquidado && (
        <Alert>
          <AlertDescription>
            Esta compra ya tiene un costeo guardado. Si cambias algún monto o el IGV, el costeo se borra y tendrás que
            volver a guardarlo en la pestaña Costeo.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>IGV de la factura</CardTitle>
          <CardDescription>El precio de compra de cada modelo se indica en la pestaña Ítems.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <CampoInterruptor
            control={control}
            nombre="precio_incluye_igv"
            etiqueta="Los precios de la factura incluyen IGV"
            ayuda="Si los incluyen, el valor de compra es el precio ÷ 1.18 y la diferencia es el IGV."
            disabled={liquidado}
          />
          <CampoInterruptor
            control={control}
            nombre="impuestos_recuperables_al_costo"
            etiqueta="Cargar el IGV al costo"
            ayuda="Si la empresa usa el IGV como crédito fiscal (régimen general), desactívalo: solo el valor de compra irá al costo. Pendiente de confirmar con el contador."
            disabled={liquidado}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gastos en soles</CardTitle>
          <CardDescription>Flete y otros gastos se reparten por cantidad de unidades; el armado es por unidad.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campo('flete_nacional_pen', 'Flete Lima → Arequipa (S/)')}
          {campo('otros_gastos_pen', 'Otros gastos (S/)', 'Estiba, embalaje, trámites…')}
          {campo('costo_armado_unitario_pen', 'Armado por unidad (S/)')}
        </CardContent>
      </Card>

      {!liquidado && (
        <div>
          <Button type="submit" disabled={pendiente || !isDirty}>
            {pendiente ? 'Guardando…' : 'Guardar costos'}
          </Button>
        </div>
      )}
    </form>
  );
}
