'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { avisar } from '@/lib/toast';
import { iniciarEnsamble } from './acciones';

export function BotonIniciarEnsamble({ vehicleId, vin }: { vehicleId: string; vin: string }) {
  const [pendiente, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pendiente}
      aria-label={`Iniciar ensamble de ${vin}`}
      onClick={() => startTransition(async () => void avisar(await iniciarEnsamble(vehicleId), `${vin} en ensamble`))}
    >
      {pendiente ? 'Moviendo…' : 'Iniciar ensamble'}
    </Button>
  );
}
