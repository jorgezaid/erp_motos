'use client';

import { X } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { esSerialProvisional } from '@/lib/taller';
import { avisar } from '@/lib/toast';
import { guardarBaterias, quitarBateria, reemplazarSerialProvisional } from './acciones';

type Bateria = { id: string; serial: string; posicion: number | null };

/** Paso 1 (SPEC M4): N casillas según el voltaje (48V → 4, 60V → 5, 72V → 6). Enter = siguiente. */
export function SeccionBaterias({
  vehicleId,
  esperadas,
  registradas,
  editable,
}: {
  vehicleId: string;
  esperadas: number;
  registradas: Bateria[];
  editable: boolean;
}) {
  const [valores, setValores] = useState<Record<number, string>>({});
  const [pendiente, startTransition] = useTransition();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const porPosicion = new Map(registradas.map((b) => [b.posicion, b]));
  const posiciones = Array.from({ length: esperadas }, (_, i) => i + 1);
  const libres = posiciones.filter((p) => !porPosicion.has(p));

  function siguiente(desde: number) {
    const proxima = libres.find((p) => p > desde);
    if (proxima) refs.current[proxima]?.focus();
  }

  function guardar() {
    const seriales = libres
      .map((posicion) => ({ posicion, serial: (valores[posicion] ?? '').trim() }))
      .filter((s) => s.serial);
    if (seriales.length === 0) return;
    startTransition(async () => {
      const r = await guardarBaterias({ vehicleId, seriales });
      if (avisar(r, r.ok ? `${r.datos.guardadas} serial(es) guardados` : undefined)) setValores({});
    });
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {registradas.length} de {esperadas} registradas
      </p>
      <ol className="grid gap-2" aria-label="Seriales de batería">
        {posiciones.map((p) => {
          const b = porPosicion.get(p);
          return (
            <li key={p} className="grid grid-cols-[3rem_1fr_auto] items-center gap-2">
              <Label htmlFor={`bateria-${p}`} className="text-muted-foreground">
                #{p}
              </Label>
              {b && esSerialProvisional(b.serial) ? (
                <ReemplazoProvisional vehicleId={vehicleId} bateria={b} posicion={p} />
              ) : b ? (
                <>
                  <p id={`bateria-${p}`} className="truncate rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                    {b.serial}
                  </p>
                  {editable ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar batería ${p}`}
                      disabled={pendiente}
                      onClick={() =>
                        startTransition(async () => void avisar(await quitarBateria(vehicleId, b.id), `Batería ${p} quitada`))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  ) : (
                    <span />
                  )}
                </>
              ) : (
                <>
                  <Input
                    id={`bateria-${p}`}
                    ref={(el) => {
                      refs.current[p] = el;
                    }}
                    aria-label={`Serial de batería ${p}`}
                    value={valores[p] ?? ''}
                    disabled={!editable}
                    autoComplete="off"
                    className="font-mono"
                    onChange={(e) => setValores((v) => ({ ...v, [p]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        siguiente(p);
                      }
                    }}
                  />
                  <span />
                </>
              )}
            </li>
          );
        })}
      </ol>
      {editable && libres.length > 0 && (
        <div>
          <Button onClick={guardar} disabled={pendiente || libres.every((p) => !(valores[p] ?? '').trim())}>
            {pendiente ? 'Guardando…' : 'Guardar seriales'}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * D37: batería con serial provisional (PROV-) de «Listo rápido»: se reemplaza por el real en
 * cualquier estado de la moto (también en tienda o vendida).
 */
function ReemplazoProvisional({ vehicleId, bateria, posicion }: { vehicleId: string; bateria: Bateria; posicion: number }) {
  const [valor, setValor] = useState('');
  const [pendiente, startTransition] = useTransition();
  function reemplazar() {
    if (!valor.trim()) return;
    startTransition(async () => {
      if (avisar(await reemplazarSerialProvisional(vehicleId, bateria.id, valor), `Batería ${posicion}: serial real guardado`)) {
        setValor('');
      }
    });
  }
  return (
    <>
      <div className="grid gap-1">
        <Input
          id={`bateria-${posicion}`}
          aria-label={`Serial real de la batería ${posicion}`}
          placeholder={bateria.serial}
          value={valor}
          autoComplete="off"
          className="border-amber-400 font-mono dark:border-amber-700"
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              reemplazar();
            }
          }}
        />
        <span className="text-xs text-muted-foreground">Provisional: {bateria.serial}</span>
      </div>
      <Button size="sm" variant="outline" disabled={pendiente || !valor.trim()} onClick={reemplazar}>
        {pendiente ? 'Guardando…' : 'Reemplazar'}
      </Button>
    </>
  );
}
