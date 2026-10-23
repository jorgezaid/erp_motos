'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { CampoTexto } from '@/components/formulario/campo';
import { CampoSelect } from '@/components/formulario/campo-select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { OpcionProveedor } from '@/lib/consultas/proveedores';
import {
  codigoCompraLocal,
  esquemaNuevaCompraLocal,
  PROVEEDOR_NUEVO,
  type EntradaNuevaCompraLocal,
} from '@/lib/esquemas/compra-local';
import { hoyLima } from '@/lib/format';
import { avisar } from '@/lib/toast';
import { crearCompraLocal } from './acciones';

/**
 * Nueva compra local (D41): proveedor (o uno nuevo con su RUC), factura, código sugerido
 * `CL-<factura>` (editable), fecha de compra y si el precio de la factura incluye IGV.
 */
export function DialogoCompraLocal({ proveedores }: { proveedores: OpcionProveedor[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const inicial: EntradaNuevaCompraLocal = {
    proveedor_id: proveedores.length ? '' : PROVEEDOR_NUEVO,
    proveedor_nombre: '',
    proveedor_ruc: '',
    nro_factura: '',
    codigo_embarque: '',
    fecha_compra: hoyLima(),
    precio_incluye_igv: true,
  };
  const {
    register,
    control,
    handleSubmit,
    getValues,
    getFieldState,
    setValue,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquemaNuevaCompraLocal), defaultValues: inicial });
  const proveedor = useWatch({ control, name: 'proveedor_id' });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      const r = await crearCompraLocal(valores);
      if (avisar(r, 'Compra local creada')) {
        setAbierto(false);
        router.push(`/lotes/${r.datos.id}/packing`);
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
      <DialogTrigger asChild>
        <Button variant="outline">Nueva compra local</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva compra local</DialogTitle>
          <DialogDescription>
            Motos compradas a un proveedor en el Perú, en soles. Los ítems y los gastos se completan después.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          <CampoSelect
            control={control}
            nombre="proveedor_id"
            etiqueta="Proveedor"
            opciones={[...proveedores, { valor: PROVEEDOR_NUEVO, etiqueta: '+ Proveedor nuevo' }]}
            error={errors.proveedor_id?.message}
            placeholder="Elige el proveedor"
          />
          {proveedor === PROVEEDOR_NUEVO && (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto
                etiqueta="Nombre del proveedor"
                registro={register('proveedor_nombre')}
                error={errors.proveedor_nombre?.message}
              />
              <CampoTexto
                etiqueta="RUC"
                inputMode="numeric"
                registro={register('proveedor_ruc')}
                error={errors.proveedor_ruc?.message}
                ayuda="Opcional: 11 dígitos."
              />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              etiqueta="N.º de factura"
              registro={register('nro_factura', {
                // Sugiere el código mientras el usuario no lo haya cambiado a mano
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  if (!getFieldState('codigo_embarque').isDirty) {
                    setValue('codigo_embarque', codigoCompraLocal(e.target.value));
                  }
                },
              })}
              error={errors.nro_factura?.message}
              placeholder="F001-000123"
            />
            <CampoTexto
              etiqueta="Código"
              registro={register('codigo_embarque')}
              error={errors.codigo_embarque?.message}
              ayuda="Se sugiere CL-<factura>; puedes cambiarlo."
            />
            <CampoTexto
              etiqueta="Fecha de compra"
              type="date"
              registro={register('fecha_compra')}
              error={errors.fecha_compra?.message}
            />
          </div>
          <div className="flex items-start gap-3 rounded-md border p-3">
            <Controller
              control={control}
              name="precio_incluye_igv"
              render={({ field }) => (
                <Switch id="nueva-incluye-igv" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <div className="grid gap-1">
              <Label htmlFor="nueva-incluye-igv">Los precios de la factura incluyen IGV</Label>
              <p className="text-xs text-muted-foreground">Se puede cambiar después en la pestaña Costos.</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? 'Creando…' : 'Crear compra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
