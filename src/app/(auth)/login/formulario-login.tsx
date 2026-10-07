'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { iniciarSesion } from '../acciones';
import { esquemaLogin } from '../esquemas';

type Campos = z.input<typeof esquemaLogin>;

export function FormularioLogin({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Campos>({ resolver: zodResolver(esquemaLogin), defaultValues: { email: '', password: '', next } });

  const enviar = handleSubmit((datos) => {
    setError(null);
    startTransition(async () => {
      const r = await iniciarSesion(datos);
      // Si tuvo éxito, la acción redirige y no vuelve aquí
      if (r && !r.ok) setError(r.error);
    });
  });

  return (
    <form onSubmit={enviar} className="grid gap-4" noValidate>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" autoFocus {...register('email')} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>
      <Button type="submit" disabled={pendiente}>
        {pendiente ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  );
}
