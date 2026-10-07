'use client';

import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { CampoSelect } from '@/components/formulario/campo-select';
import { CampoTexto } from '@/components/formulario/campo';
import type { EntradaCliente } from '@/lib/ventas';

const TIPOS_DOC = [
  { valor: 'DNI', etiqueta: 'DNI' },
  { valor: 'RUC', etiqueta: 'RUC' },
  { valor: 'CE', etiqueta: 'Carné de extranjería' },
];

/**
 * Datos del cliente (SPEC M6, RN-20). Recibe el `register`/`control` de un formulario cuyos campos
 * incluyen los del cliente. `soloContacto`: en una venta confirmada solo teléfono y email (RN-17).
 */
export function CamposCliente({
  register,
  control,
  errors,
  soloContacto = false,
}: {
  register: UseFormRegister<EntradaCliente>;
  control: Control<EntradaCliente, unknown, EntradaCliente>;
  errors: FieldErrors<EntradaCliente>;
  soloContacto?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoTexto
        etiqueta="Nombre o razón social"
        registro={register('cliente_nombre')}
        error={errors.cliente_nombre?.message}
        disabled={soloContacto}
        className="sm:col-span-2"
      />
      <CampoSelect
        control={control}
        nombre="cliente_tipo_documento"
        etiqueta="Tipo de documento"
        opciones={TIPOS_DOC}
        error={errors.cliente_tipo_documento?.message}
        disabled={soloContacto}
      />
      <CampoTexto
        etiqueta="N.º de documento"
        registro={register('cliente_documento')}
        error={errors.cliente_documento?.message}
        disabled={soloContacto}
      />
      <CampoTexto etiqueta="Teléfono" type="tel" registro={register('cliente_telefono')} error={errors.cliente_telefono?.message} />
      <CampoTexto etiqueta="Email" type="email" registro={register('cliente_email')} error={errors.cliente_email?.message} />
    </div>
  );
}
