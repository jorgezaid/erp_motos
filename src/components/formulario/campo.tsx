'use client';

import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Base = { etiqueta: string; error?: string; ayuda?: React.ReactNode; className?: string };

/** Etiqueta + control + mensaje de error accesible (aria-invalid / aria-describedby). */
export function Campo({
  etiqueta,
  error,
  ayuda,
  className,
  children,
  id,
}: Base & { id: string; children: React.ReactNode }) {
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda && !error && <p className="text-xs text-muted-foreground">{ayuda}</p>}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function CampoTexto({
  registro,
  type = 'text',
  inputMode,
  placeholder,
  disabled,
  autoComplete,
  ...base
}: Base & {
  registro: UseFormRegisterReturn;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <Campo {...base} id={id}>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={!!base.error}
        aria-describedby={base.error ? `${id}-error` : undefined}
        {...registro}
      />
    </Campo>
  );
}

export function CampoArea({ registro, disabled, ...base }: Base & { registro: UseFormRegisterReturn; disabled?: boolean }) {
  const id = useId();
  return (
    <Campo {...base} id={id}>
      <Textarea id={id} disabled={disabled} aria-invalid={!!base.error} {...registro} />
    </Campo>
  );
}
