'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ESTADO_RECLAMO } from '@/lib/etiquetas';
import { ACCION_ESTADO, siguientesEstados, type EstadoReclamo } from '@/lib/garantias';
import { avisar } from '@/lib/toast';
import { atenderReclamo, registrarReclamo } from './acciones';

export function DialogoReclamo({ warrantyId, vin, cobertura }: { warrantyId: string; vin: string; cobertura: string }) {
  const [abierto, setAbierto] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [pendiente, startTransition] = useTransition();
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label={`Registrar reclamo de ${vin} (${cobertura})`}>
          Registrar reclamo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reclamo de garantía</DialogTitle>
          <DialogDescription>
            {vin} · cobertura {cobertura}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="reclamo-descripcion">¿Qué problema reporta el cliente?</Label>
          <Textarea id="reclamo-descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <DialogFooter>
          <Button
            disabled={pendiente}
            onClick={() =>
              startTransition(async () => {
                if (avisar(await registrarReclamo({ warrantyId, descripcion }), 'Reclamo registrado')) {
                  setDescripcion('');
                  setAbierto(false);
                }
              })
            }
          >
            {pendiente ? 'Registrando…' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Seguimiento del reclamo (admin y técnico): diagnóstico, costo y siguiente estado. */
export function DialogoAtender({
  claimId,
  vin,
  estado,
  diagnostico,
  costo,
}: {
  claimId: string;
  vin: string;
  estado: EstadoReclamo;
  diagnostico: string | null;
  costo: number | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [diag, setDiag] = useState(diagnostico ?? '');
  const [monto, setMonto] = useState(costo === null ? '' : String(costo));
  const [pendiente, startTransition] = useTransition();
  const siguientes = siguientesEstados(estado);

  function guardar(nuevo: EstadoReclamo) {
    startTransition(async () => {
      const r = await atenderReclamo({ claimId, estado: nuevo, diagnostico: diag, costo: monto });
      if (avisar(r, nuevo === estado ? 'Reclamo actualizado' : `Reclamo: ${ESTADO_RECLAMO[nuevo].toLowerCase()}`)) setAbierto(false);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label={`Atender reclamo de ${vin}`}>
          Atender
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atender reclamo</DialogTitle>
          <DialogDescription>
            {vin} · estado actual: {ESTADO_RECLAMO[estado]}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="reclamo-diagnostico">Diagnóstico</Label>
            <Textarea id="reclamo-diagnostico" value={diag} onChange={(e) => setDiag(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reclamo-costo">Costo de reparación (S/)</Label>
            <Input id="reclamo-costo" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" disabled={pendiente} onClick={() => guardar(estado)}>
            Guardar
          </Button>
          {siguientes.map((s) => (
            <Button key={s} disabled={pendiente} variant={s === 'rechazado' ? 'destructive' : 'default'} onClick={() => guardar(s)}>
              {ACCION_ESTADO[s]}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
