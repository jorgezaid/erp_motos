'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { CampoSelect } from '@/components/formulario/campo-select';
import { CampoArea, CampoTexto } from '@/components/formulario/campo';
import { Button } from '@/components/ui/button';
import type { OpcionProveedor } from '@/lib/consultas/proveedores';
import {
  ESTADOS_COMPRA_LOCAL_EDITABLES,
  esquemaDatosCompraLocal,
  type EntradaDatosCompraLocal,
} from '@/lib/esquemas/compra-local';
import { ESTADO_LOTE } from '@/lib/etiquetas';
import { avisar } from '@/lib/toast';
import { guardarDatosLote } from './acciones';

const OPCIONES_ESTADO = ESTADOS_COMPRA_LOCAL_EDITABLES.map((e) => ({ valor: e, etiqueta: ESTADO_LOTE[e] }));

/** Pestaña Datos de una compra local (D41): código, factura, proveedor, fechas y estado (sin aduanas). */
export function FormularioDatosCompraLocal({
  id,
  inicial,
  liquidado,
  proveedores,
}: {
  id: string;
  inicial: EntradaDatosCompraLocal;
  liquidado: boolean;
  proveedores: OpcionProveedor[];
}) {
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    // Liquidado: solo se editan las notas y el proveedor, sin validar el resto
    resolver: liquidado ? undefined : zodResolver(esquemaDatosCompraLocal),
    defaultValues: inicial,
  });

  const enviar = handleSubmit(() => {
    const valores = getValues();
    startTransition(async () => {
      avisar(await guardarDatosLote(id, valores), 'Datos de la compra guardados');
    });
  });

  return (
    <form onSubmit={enviar} className="grid max-w-3xl gap-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto
          etiqueta="Código"
          registro={register('codigo_embarque')}
          error={errors.codigo_embarque?.message}
          disabled={liquidado}
        />
        <CampoTexto
          etiqueta="N.º de factura"
          registro={register('nro_factura')}
          error={errors.nro_factura?.message}
          disabled={liquidado}
        />
        <CampoSelect
          control={control}
          nombre="proveedor_id"
          etiqueta="Proveedor"
          opciones={proveedores}
          error={errors.proveedor_id?.message}
          placeholder="Elige el proveedor"
          ayuda={
            <Link href="/admin/proveedores" className="underline">
              Administrar proveedores
            </Link>
          }
        />
        {liquidado ? (
          <CampoTexto etiqueta="Estado" registro={register('estado')} disabled />
        ) : (
          <CampoSelect
            control={control}
            nombre="estado"
            etiqueta="Estado"
            opciones={OPCIONES_ESTADO}
            error={errors.estado?.message}
            ayuda="Una compra local no pasa por aduanas. Para liquidar, usa la pestaña Costeo."
          />
        )}
        <CampoTexto
          etiqueta="Fecha de compra"
          type="date"
          registro={register('fecha_compra')}
          error={errors.fecha_compra?.message}
          disabled={liquidado}
        />
        <CampoTexto
          etiqueta="Fecha de llegada a Arequipa"
          type="date"
          registro={register('fecha_llegada')}
          error={errors.fecha_llegada?.message}
          disabled={liquidado}
        />
      </div>
      <CampoArea
        etiqueta="Notas"
        registro={register('notas')}
        error={errors.notas?.message}
        ayuda={liquidado ? 'En una compra liquidada solo se pueden editar las notas y el proveedor (RN-08).' : undefined}
      />
      <div>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? 'Guardando…' : liquidado ? 'Guardar notas y proveedor' : 'Guardar datos'}
        </Button>
      </div>
    </form>
  );
}
