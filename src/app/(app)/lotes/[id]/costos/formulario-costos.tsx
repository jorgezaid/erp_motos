'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { CampoTexto } from '@/components/formulario/campo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { impuestosAsignables, impuestosSunat } from '@/lib/costing/impuestos';
import { esquemaCostosLote, type EntradaCostosLote } from '@/lib/esquemas/lote';
import { formatPEN } from '@/lib/format';
import { avisar } from '@/lib/toast';
import { guardarCostosLote } from '../acciones';

type Campo = Exclude<keyof EntradaCostosLote, 'impuestos_recuperables_al_costo'>;

export function FormularioCostos({
  id,
  inicial,
  liquidado,
  hayCosteo,
}: {
  id: string;
  inicial: EntradaCostosLote;
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
  } = useForm({ resolver: zodResolver(esquemaCostosLote), defaultValues: inicial });
  const impuestos = useWatch({ control, name: ['ad_valorem_pen', 'igv_pen', 'ipm_pen', 'percepcion_pen', 'impuestos_recuperables_al_costo'] });
  const vistaImpuestos = {
    ad_valorem_pen: impuestos[0],
    igv_pen: impuestos[1],
    ipm_pen: impuestos[2],
    percepcion_pen: impuestos[3],
    impuestos_recuperables_al_costo: impuestos[4],
  };

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      if (avisar(await guardarCostosLote(id, valores), 'Costos del lote guardados')) reset(valores);
    });
  });

  const campo = (nombre: Campo, etiqueta: string, ayuda?: string) => (
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
            Este lote ya tiene un costeo guardado. Si cambias algún monto o el tipo de cambio, el costeo se borra y
            tendrás que volver a guardarlo en la pestaña Costeo.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Costos en dólares</CardTitle>
          <CardDescription>FOB se prorratea por valor EXW; flete y agente, por volumen (CBM).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {campo('tipo_cambio', 'Tipo de cambio (S/ por US$)', 'Obligatorio para liquidar (RN-07).')}
          {campo('fob_total_usd', 'FOB total (US$)')}
          {campo('flete_internacional_usd', 'Flete internacional (US$)')}
          {campo('gastos_agente_usd', 'Gastos del agente (US$)')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tributos SUNAT</CardTitle>
          <CardDescription>Se prorratean por valor EXW.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {campo('ad_valorem_pen', 'Ad Valorem (S/)')}
            {campo('igv_pen', 'IGV (S/)')}
            {campo('ipm_pen', 'IPM (S/)')}
            {campo('percepcion_pen', 'Percepción (S/)')}
          </div>
          <div className="flex items-start gap-3 rounded-md border p-3">
            <Controller
              control={control}
              name="impuestos_recuperables_al_costo"
              render={({ field }) => (
                <Switch
                  id="recuperables"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={liquidado}
                  aria-describedby="recuperables-ayuda"
                />
              )}
            />
            <div className="grid gap-1">
              <Label htmlFor="recuperables">Cargar IGV, IPM y percepción al costo (RN-05)</Label>
              <p id="recuperables-ayuda" className="text-xs text-muted-foreground">
                Si la empresa los usa como crédito fiscal (régimen general), desactívalo: solo el Ad Valorem irá al
                costo. Pendiente de confirmar con el contador.
              </p>
            </div>
          </div>
          <dl className="grid gap-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">Total tributos SUNAT</dt>
              <dd className="font-medium">{formatPEN(impuestosSunat(vistaImpuestos))}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">Asignables al costo</dt>
              <dd className="font-medium" data-testid="impuestos-asignables">
                {formatPEN(impuestosAsignables(vistaImpuestos))}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Costos nacionales</CardTitle>
          <CardDescription>
            Flete nacional por CBM; alquiler, sueldos y publicidad por cantidad de unidades; armado por unidad.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campo('flete_nacional_pen', 'Flete nacional (S/)')}
          {campo('alquiler_periodo_pen', 'Alquiler del periodo (S/)')}
          {campo('sueldos_periodo_pen', 'Sueldos del periodo (S/)')}
          {campo('publicidad_inicial_pen', 'Publicidad inicial (S/)')}
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
