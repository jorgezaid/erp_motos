'use client';

import { MoveRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { textoMovidas } from '@/lib/esquemas/mover';
import { avisar } from '@/lib/toast';
import { moverUnidades } from './acciones';

export type Ubicacion = { id: string; nombre: string };

/**
 * D40: la ubicación de una fila como selector; al elegir otra se guarda al instante. La BD
 * vuelve a validar (vendida, ubicación activa) y su error se muestra tal cual.
 */
export function SelectorUbicacion({
  vehicleId,
  vin,
  ubicacionId,
  ubicaciones,
}: {
  vehicleId: string;
  vin: string;
  ubicacionId: string | null;
  ubicaciones: Ubicacion[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  function mover(destino: string) {
    if (destino === ubicacionId) return;
    const nombre = ubicaciones.find((u) => u.id === destino)?.nombre ?? '';
    startTransition(async () => {
      const r = await moverUnidades({ vehicleIds: [vehicleId], ubicacionId: destino });
      if (avisar(r, `${vin} movida a ${nombre}`)) router.refresh();
    });
  }

  return (
    <Select value={ubicacionId ?? undefined} onValueChange={mover} disabled={pendiente}>
      <SelectTrigger size="sm" className="min-w-40" aria-label={`Ubicación de ${vin}`}>
        <SelectValue placeholder="Sin ubicación" />
      </SelectTrigger>
      <SelectContent>
        {ubicaciones.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** D40: «Mover a…» de las motos seleccionadas (todas o ninguna). */
export function DialogoMover({
  vehicleIds,
  ubicaciones,
  onCerrar,
}: {
  vehicleIds: string[];
  ubicaciones: Ubicacion[];
  onCerrar: (movidas?: boolean) => void;
}) {
  const router = useRouter();
  const [destino, setDestino] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const n = vehicleIds.length;

  function confirmar() {
    if (!destino) return;
    const nombre = ubicaciones.find((u) => u.id === destino)?.nombre ?? '';
    startTransition(async () => {
      const r = await moverUnidades({ vehicleIds, ubicacionId: destino });
      if (avisar(r, r.ok ? textoMovidas(r.datos.movidas, nombre) : undefined)) {
        onCerrar(true);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open onOpenChange={(a) => !a && !pendiente && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Mover {n} {n === 1 ? 'moto' : 'motos'}
          </DialogTitle>
          <DialogDescription>Se mueven todas o ninguna. Las motos vendidas no se pueden mover.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="ubicacion-mover">Mover a</Label>
          <Select value={destino ?? undefined} onValueChange={setDestino}>
            <SelectTrigger id="ubicacion-mover" className="w-full">
              <SelectValue placeholder="Elige la ubicación" />
            </SelectTrigger>
            <SelectContent>
              {ubicaciones.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={pendiente} onClick={() => onCerrar()}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={pendiente || !destino}>
            <MoveRight className="size-4" aria-hidden /> {pendiente ? 'Moviendo…' : 'Mover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
