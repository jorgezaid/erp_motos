'use client';

import { useState, useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

/**
 * Botón con diálogo de confirmación (acciones irreversibles o que congelan datos).
 * `alConfirmar` devuelve true si tuvo éxito (el diálogo se cierra); si no, queda abierto.
 * `children` puede agregar campos al diálogo (p. ej. el motivo de una anulación).
 */
export function BotonConfirmar({
  etiqueta,
  titulo,
  descripcion,
  confirmar = 'Confirmar',
  variante = 'default',
  deshabilitado,
  alConfirmar,
  children,
}: {
  etiqueta: React.ReactNode;
  titulo: string;
  descripcion: React.ReactNode;
  confirmar?: string;
  variante?: 'default' | 'destructive' | 'outline';
  deshabilitado?: boolean;
  alConfirmar: () => Promise<boolean>;
  children?: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();

  return (
    <AlertDialog open={abierto} onOpenChange={setAbierto}>
      <AlertDialogTrigger asChild>
        <Button variant={variante} disabled={deshabilitado}>
          {etiqueta}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{descripcion}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <Button
            variant={variante === 'outline' ? 'default' : variante}
            disabled={pendiente}
            onClick={() =>
              startTransition(async () => {
                if (await alConfirmar()) setAbierto(false);
              })
            }
          >
            {pendiente ? 'Procesando…' : confirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
