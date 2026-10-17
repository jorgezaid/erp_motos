'use client';

import { Zap } from 'lucide-react';
import { createContext, useContext, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { serialProvisional, ubicacionPorDefecto } from '@/lib/taller';
import { avisar } from '@/lib/toast';
import { listoRapido } from './acciones';

/** Una moto de la página para «Listo rápido»: `libres` son las posiciones de batería por llenar. */
export type MotoRapida = { vehicleId: string; vin: string; codigo: string; libres: number[] };
type Ubicacion = { id: string; nombre: string };

type Contexto = {
  seleccion: Set<string>;
  alternar: (id: string, marcada: boolean) => void;
  abrir: (ids: string[]) => void;
};

const SeleccionTaller = createContext<Contexto | null>(null);

function useSeleccion(): Contexto {
  const c = useContext(SeleccionTaller);
  if (!c) throw new Error('Falta <ListoRapidoProvider>');
  return c;
}

/**
 * D37: selección de motos del Taller, barra «Listo rápido (N)» y el diálogo. Las tarjetas usan
 * `CasillaMoto` y `BotonListoRapido`.
 */
export function ListoRapidoProvider({
  motos,
  ubicaciones,
  children,
}: {
  motos: MotoRapida[];
  ubicaciones: Ubicacion[];
  children: React.ReactNode;
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [enDialogo, setEnDialogo] = useState<string[] | null>(null);
  const porId = new Map(motos.map((m) => [m.vehicleId, m]));
  // Solo cuenta lo que sigue en la página (tras pasar a tienda, las motos desaparecen)
  const elegidas = [...seleccion].filter((id) => porId.has(id));

  const contexto: Contexto = {
    seleccion,
    alternar: (id, marcada) =>
      setSeleccion((s) => {
        const n = new Set(s);
        if (marcada) n.add(id);
        else n.delete(id);
        return n;
      }),
    abrir: setEnDialogo,
  };

  return (
    <SeleccionTaller.Provider value={contexto}>
      {children}
      {elegidas.length > 0 && (
        <div
          role="region"
          aria-label="Motos seleccionadas"
          className="sticky bottom-4 z-10 mx-auto mt-4 flex w-fit max-w-full flex-wrap items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg"
        >
          <span className="text-sm font-medium">
            {elegidas.length} {elegidas.length === 1 ? 'moto seleccionada' : 'motos seleccionadas'}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSeleccion(new Set())}>
            Quitar selección
          </Button>
          <Button size="sm" onClick={() => setEnDialogo(elegidas)}>
            <Zap className="size-4" aria-hidden /> Listo rápido ({elegidas.length})
          </Button>
        </div>
      )}
      {enDialogo && (
        <DialogoListoRapido
          motos={enDialogo.flatMap((id) => porId.get(id) ?? [])}
          ubicaciones={ubicaciones}
          onCerrar={(listas) => {
            setEnDialogo(null);
            if (listas) setSeleccion((s) => new Set([...s].filter((id) => !listas.includes(id))));
          }}
        />
      )}
    </SeleccionTaller.Provider>
  );
}

/** Casilla para seleccionar la moto de una tarjeta. */
export function CasillaMoto({ vehicleId, vin }: { vehicleId: string; vin: string }) {
  const { seleccion, alternar } = useSeleccion();
  return (
    <Checkbox
      aria-label={`Seleccionar ${vin}`}
      checked={seleccion.has(vehicleId)}
      onCheckedChange={(v) => alternar(vehicleId, v === true)}
    />
  );
}

/** «Listo rápido» de una sola moto. */
export function BotonListoRapido({ vehicleId, vin }: { vehicleId: string; vin: string }) {
  const { abrir } = useSeleccion();
  return (
    <Button size="sm" variant="secondary" aria-label={`Listo rápido ${vin}`} onClick={() => abrir([vehicleId])}>
      <Zap className="size-4" aria-hidden /> Listo rápido
    </Button>
  );
}

/**
 * D37: ubicación (Showroom Piérola por defecto) y una casilla por batería que falte. Las vacías
 * se guardan como «PROV-<VIN>-<n>». Enter = siguiente casilla, como el escáner.
 */
function DialogoListoRapido({
  motos,
  ubicaciones,
  onCerrar,
}: {
  motos: MotoRapida[];
  ubicaciones: Ubicacion[];
  onCerrar: (listas?: string[]) => void;
}) {
  const [ubicacion, setUbicacion] = useState<string | null>(() => ubicacionPorDefecto(ubicaciones));
  const [seriales, setSeriales] = useState<Record<string, string>>({});
  const [pendiente, startTransition] = useTransition();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const clave = (id: string, p: number) => `${id}:${p}`;
  // Orden de las casillas para que Enter pase a la siguiente, también entre motos
  const orden = motos.flatMap((m) => m.libres.map((p) => clave(m.vehicleId, p)));

  function confirmar() {
    if (!ubicacion) return;
    startTransition(async () => {
      const r = await listoRapido({
        ubicacionId: ubicacion,
        unidades: motos.map((m) => ({
          vehicleId: m.vehicleId,
          seriales: m.libres.map((posicion) => ({ posicion, serial: seriales[clave(m.vehicleId, posicion)] ?? '' })),
        })),
      });
      const mensaje = r.ok
        ? `${r.datos.unidades} ${r.datos.unidades === 1 ? 'moto lista' : 'motos listas'} en tienda` +
          (r.datos.provisionales > 0 ? ` (${r.datos.provisionales} baterías sin serial real)` : '')
        : undefined;
      if (avisar(r, mensaje)) onCerrar(motos.map((m) => m.vehicleId));
    });
  }

  return (
    <Dialog open onOpenChange={(a) => !a && !pendiente && onCerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Listo rápido{motos.length > 1 ? ` (${motos.length} motos)` : ''}</DialogTitle>
          <DialogDescription>
            Ensambla, registra las baterías, marca toda la inspección y pasa a tienda. Las casillas vacías quedan con un serial
            provisional («Baterías sin serial real»).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="ubicacion-listo-rapido">Ubicación</Label>
          <Select value={ubicacion ?? undefined} onValueChange={setUbicacion}>
            <SelectTrigger id="ubicacion-listo-rapido" className="w-full" aria-label="Ubicación">
              <SelectValue placeholder="Elige dónde se exhibirá" />
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
        <div className="grid gap-4">
          {motos.map((m) => (
            <fieldset key={m.vehicleId} className="grid gap-2">
              <legend className="mb-1 text-sm">
                <span className="font-mono font-semibold">{m.vin}</span>{' '}
                <span className="text-muted-foreground">· {m.codigo}</span>
              </legend>
              {m.libres.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ya tiene todas sus baterías.</p>
              ) : (
                m.libres.map((p) => {
                  const i = orden.indexOf(clave(m.vehicleId, p));
                  return (
                    <div key={p} className="grid grid-cols-[3rem_1fr] items-center gap-2">
                      <Label htmlFor={`lr-${m.vehicleId}-${p}`} className="text-muted-foreground">
                        #{p}
                      </Label>
                      <Input
                        id={`lr-${m.vehicleId}-${p}`}
                        ref={(el) => {
                          refs.current[i] = el;
                        }}
                        aria-label={`Serial de batería ${p} de ${m.vin}`}
                        placeholder={serialProvisional(m.vin, p)}
                        value={seriales[clave(m.vehicleId, p)] ?? ''}
                        autoComplete="off"
                        className="font-mono"
                        onChange={(e) => setSeriales((s) => ({ ...s, [clave(m.vehicleId, p)]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            refs.current[i + 1]?.focus();
                          }
                        }}
                      />
                    </div>
                  );
                })
              )}
            </fieldset>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={pendiente} onClick={() => onCerrar()}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={pendiente || !ubicacion || motos.length === 0}>
            {pendiente ? 'Guardando…' : 'Pasar a tienda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
