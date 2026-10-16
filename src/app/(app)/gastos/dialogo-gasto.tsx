'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { CampoSelect } from '@/components/formulario/campo-select';
import { Campo, CampoTexto } from '@/components/formulario/campo';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CATEGORIA_GASTO, ESTADO_GASTO, METODO_PAGO_GASTO, opciones } from '@/lib/etiquetas';
import { esquemaGasto, gastoVacio, type EntradaGasto } from '@/lib/esquemas/gasto';
import { ACEPTA_COMPROBANTE, validarComprobante } from '@/lib/gastos';
import { avisar } from '@/lib/toast';
import { guardarGasto } from './acciones';

/** Alta y edición de un gasto, con su comprobante opcional (PDF o imagen). */
export function DialogoGasto({
  id = null,
  inicial,
  hoy,
  tieneComprobante = false,
  disparador,
}: {
  id?: string | null;
  inicial?: EntradaGasto;
  /** Fecha de Lima (aaaa-mm-dd) para los valores por defecto */
  hoy: string;
  tieneComprobante?: boolean;
  disparador: React.ReactNode;
}) {
  const valoresIniciales = inicial ?? gastoVacio(hoy);
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | undefined>();
  const [quitar, setQuitar] = useState(false);
  // Cambiar la key vacía el input de archivo (no se puede asignar su valor)
  const [claveArchivo, setClaveArchivo] = useState(0);
  const idArchivo = useId();
  const idQuitar = useId();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquemaGasto), defaultValues: valoresIniciales });
  const estado = useWatch({ control, name: 'estado' });

  function limpiarArchivo() {
    setArchivo(null);
    setErrorArchivo(undefined);
    setQuitar(false);
    setClaveArchivo((k) => k + 1);
  }

  function elegirArchivo(f: File | null) {
    setArchivo(f);
    setErrorArchivo(f ? (validarComprobante(f) ?? undefined) : undefined);
  }

  const enviar = handleSubmit(() => {
    if (errorArchivo) return;
    const form = new FormData();
    form.set('datos', JSON.stringify(getValues()));
    if (archivo) form.set('comprobante', archivo);
    if (quitar && !archivo) form.set('quitarComprobante', '1');
    startTransition(async () => {
      const r = await guardarGasto(id, form);
      if (!r.ok && r.campos?.comprobante) setErrorArchivo(r.campos.comprobante);
      if (avisar(r, id ? 'Gasto actualizado' : 'Gasto registrado')) {
        setAbierto(false);
        limpiarArchivo();
        if (!id) reset(gastoVacio(hoy));
      }
    });
  });

  return (
    <Dialog
      open={abierto}
      onOpenChange={(a) => {
        setAbierto(a);
        if (a) {
          reset(valoresIniciales);
          limpiarArchivo();
        }
      }}
    >
      <DialogTrigger asChild>{disparador}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{id ? 'Editar gasto' : 'Nuevo gasto'}</DialogTitle>
          <DialogDescription>Los gastos no cambian el costo de las motos ni sus precios: se restan de la utilidad del mes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2" noValidate>
          <CampoSelect control={control} nombre="estado" etiqueta="Estado" opciones={opciones(ESTADO_GASTO)} error={errors.estado?.message} />
          {estado === 'realizado' ? (
            <CampoTexto etiqueta="Fecha de pago" type="date" registro={register('fecha')} error={errors.fecha?.message} />
          ) : (
            <CampoTexto etiqueta="Fecha estimada" type="date" registro={register('fecha_estimada')} error={errors.fecha_estimada?.message} />
          )}
          <CampoSelect
            control={control}
            nombre="categoria"
            etiqueta="Categoría"
            opciones={opciones(CATEGORIA_GASTO)}
            error={errors.categoria?.message}
          />
          <CampoTexto
            etiqueta={estado === 'realizado' ? 'Monto (S/)' : 'Monto estimado (S/)'}
            inputMode="decimal"
            placeholder="0.00"
            registro={register('monto_pen')}
            error={errors.monto_pen?.message}
          />
          <CampoTexto etiqueta="Descripción" registro={register('descripcion')} error={errors.descripcion?.message} className="sm:col-span-2" />
          <CampoTexto etiqueta="Proveedor (opcional)" registro={register('proveedor')} error={errors.proveedor?.message} />
          <CampoSelect
            control={control}
            nombre="metodo_pago"
            etiqueta={estado === 'realizado' ? 'Método de pago' : 'Método de pago (opcional)'}
            opciones={opciones(METODO_PAGO_GASTO)}
            error={errors.metodo_pago?.message}
          />
          <Campo
            id={idArchivo}
            etiqueta="Comprobante (opcional)"
            error={errorArchivo}
            ayuda="Foto o PDF, hasta 5 MB."
            className="sm:col-span-2"
          >
            <Input
              key={claveArchivo}
              id={idArchivo}
              type="file"
              accept={ACEPTA_COMPROBANTE}
              aria-invalid={!!errorArchivo}
              onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
            />
          </Campo>
          {id && tieneComprobante && !archivo && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox id={idQuitar} checked={quitar} onCheckedChange={(v) => setQuitar(v === true)} />
              <Label htmlFor={idQuitar} className="font-normal">
                Quitar el comprobante actual
              </Label>
            </div>
          )}
          {id && tieneComprobante && archivo && (
            <p className="text-xs text-muted-foreground sm:col-span-2">El archivo nuevo reemplaza al comprobante actual.</p>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pendiente}>
              {pendiente ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
