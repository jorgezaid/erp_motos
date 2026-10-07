'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { requisitosTienda } from '@/lib/taller';
import { avisar } from '@/lib/toast';
import { pasarATienda } from './acciones';

/** Paso 3 (SPEC M4): "Pasar a tienda", habilitado solo si se cumple RN-10. */
export function PasarATienda({
  vehicleId,
  vin,
  estado,
  baterias,
  esperadas,
  ultimaInspeccionAprobada,
  ubicaciones,
  ubicacionActual,
}: {
  vehicleId: string;
  vin: string;
  estado: string;
  baterias: number;
  esperadas: number;
  ultimaInspeccionAprobada: boolean | null;
  ubicaciones: { id: string; nombre: string }[];
  ubicacionActual: string | null;
}) {
  const router = useRouter();
  const tiendas = ubicaciones;
  const inicial = tiendas.some((u) => u.id === ubicacionActual) ? ubicacionActual : null;
  const [ubicacion, setUbicacion] = useState<string | null>(inicial);
  const [pendiente, startTransition] = useTransition();
  const faltan = requisitosTienda({ estado, baterias, esperadas, ultimaInspeccionAprobada, ubicacion });

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="ubicacion-tienda">Ubicación</Label>
        <Select value={ubicacion ?? undefined} onValueChange={setUbicacion}>
          <SelectTrigger id="ubicacion-tienda" className="w-full" aria-label="Ubicación">
            <SelectValue placeholder="Elige dónde se exhibirá" />
          </SelectTrigger>
          <SelectContent>
            {tiendas.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {faltan.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-muted-foreground" aria-label="Requisitos pendientes">
          {faltan.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      <Button
        size="lg"
        disabled={faltan.length > 0 || pendiente || !ubicacion}
        onClick={() =>
          startTransition(async () => {
            if (ubicacion && avisar(await pasarATienda(vehicleId, ubicacion), `${vin} lista en tienda`)) {
              router.push('/taller');
            }
          })
        }
      >
        {pendiente ? 'Moviendo…' : 'Pasar a tienda'}
      </Button>
    </div>
  );
}
