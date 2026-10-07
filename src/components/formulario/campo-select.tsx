'use client';

import { useId } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Campo } from './campo';

/** Select de shadcn conectado a react-hook-form. */
export function CampoSelect<T extends FieldValues, C = unknown, O extends FieldValues = T>({
  control,
  nombre,
  etiqueta,
  opciones,
  error,
  ayuda,
  disabled,
  placeholder = 'Elige…',
  className,
}: {
  control: Control<T, C, O>;
  nombre: FieldPath<T>;
  etiqueta: string;
  opciones: readonly { valor: string; etiqueta: string }[];
  error?: string;
  ayuda?: React.ReactNode;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <Campo id={id} etiqueta={etiqueta} error={error} ayuda={ayuda} className={className}>
      <Controller
        control={control}
        name={nombre}
        render={({ field }) => (
          <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={disabled}>
            <SelectTrigger id={id} className="w-full" aria-invalid={!!error} aria-label={etiqueta}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {opciones.map((o) => (
                <SelectItem key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Campo>
  );
}
