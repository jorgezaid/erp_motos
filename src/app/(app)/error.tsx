'use client';

import { Button } from '@/components/ui/button';

/** Error inesperado al cargar una pantalla: mensaje en español, sin detalles técnicos. */
export default function ErrorPantalla({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <h1 className="text-xl font-semibold">No se pudo cargar esta pantalla</h1>
      <p className="max-w-md text-muted-foreground">
        Ocurrió un error inesperado. Inténtalo de nuevo; si persiste, avisa al administrador.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
