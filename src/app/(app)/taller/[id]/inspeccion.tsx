'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { motivosObservada } from '@/lib/taller';
import { avisar } from '@/lib/toast';
import { registrarInspeccion } from './acciones';

const CHECKS = [
  ['vin_verificado', 'VIN verificado'],
  ['motor_verificado', 'Motor verificado'],
  ['frenos', 'Frenos'],
  ['luces', 'Luces'],
  ['claxon', 'Claxon'],
] as const;

type Marcas = Record<(typeof CHECKS)[number][0], boolean>;

/** Paso 2 (SPEC M4): checklist de inspección. RN-11: cada registro es nuevo (no se edita). */
export function FormularioInspeccion({ vehicleId, esperadas }: { vehicleId: string; esperadas: number }) {
  const [contadas, setContadas] = useState('');
  const [voltaje, setVoltaje] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [marcas, setMarcas] = useState<Marcas>({
    vin_verificado: false,
    motor_verificado: false,
    frenos: false,
    luces: false,
    claxon: false,
  });
  const [pendiente, startTransition] = useTransition();

  const n = Number(contadas);
  const vista =
    contadas !== '' && Number.isInteger(n)
      ? motivosObservada({ baterias_contadas: n, baterias_esperadas: esperadas, ...marcas })
      : null;

  function registrar() {
    startTransition(async () => {
      const r = await registrarInspeccion({
        vehicleId,
        baterias_contadas: contadas === '' ? Number.NaN : n,
        voltaje_medido: voltaje,
        observaciones,
        ...marcas,
      });
      if (avisar(r, r.ok ? (r.datos.aprobada ? 'Inspección aprobada' : 'Inspección registrada como observada') : undefined)) {
        setContadas('');
        setVoltaje('');
        setObservaciones('');
        setMarcas({ vin_verificado: false, motor_verificado: false, frenos: false, luces: false, claxon: false });
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="contadas">Baterías contadas</Label>
          <Input id="contadas" inputMode="numeric" value={contadas} onChange={(e) => setContadas(e.target.value)} />
          <p className="text-xs text-muted-foreground">El modelo lleva {esperadas}.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="voltaje">Voltaje medido (V)</Label>
          <Input id="voltaje" inputMode="decimal" value={voltaje} onChange={(e) => setVoltaje(e.target.value)} />
        </div>
      </div>
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 text-sm font-medium">Checklist</legend>
        {CHECKS.map(([k, etiqueta]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={marcas[k]}
              onCheckedChange={(v) => setMarcas((m) => ({ ...m, [k]: v === true }))}
              aria-label={etiqueta}
            />
            {etiqueta}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Textarea id="observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </div>
      {vista && (
        <p className={vista.length === 0 ? 'text-sm text-emerald-700 dark:text-emerald-400' : 'text-sm text-amber-700 dark:text-amber-400'}>
          {vista.length === 0 ? 'Se registrará como aprobada.' : `Quedará observada: ${vista.join('; ')}.`}
        </p>
      )}
      <div>
        <Button onClick={registrar} disabled={pendiente || contadas === ''}>
          {pendiente ? 'Registrando…' : 'Registrar inspección'}
        </Button>
      </div>
    </div>
  );
}
