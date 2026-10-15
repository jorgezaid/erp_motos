'use client';

import { useTransition } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Escala } from '@/lib/escalas';
import { TIPO_VENTA } from '@/lib/etiquetas';
import { avisar } from '@/lib/toast';
import { cambiarEscalaActiva } from './acciones';

/** D31: un interruptor por escala. Desactivarla la quita del POS; sus precios se conservan. */
export function InterruptoresEscalas({ escalas }: { escalas: Escala[] }) {
  const [pendiente, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3" role="group" aria-label="Escalas de venta activas">
      {escalas.map((e) => (
        <div key={e.tipo_venta} className="flex items-center gap-2">
          <Switch
            id={`escala-${e.tipo_venta}`}
            checked={e.activo}
            disabled={pendiente}
            onCheckedChange={(activo) =>
              startTransition(async () => {
                avisar(
                  await cambiarEscalaActiva({ tipoVenta: e.tipo_venta, activo }),
                  `${TIPO_VENTA[e.tipo_venta]}: ${activo ? 'activada' : 'desactivada'}`,
                );
              })
            }
          />
          <Label htmlFor={`escala-${e.tipo_venta}`}>{TIPO_VENTA[e.tipo_venta]} activa</Label>
        </div>
      ))}
    </div>
  );
}
