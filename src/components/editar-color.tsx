'use client';

import { Palette } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { editarColor } from '@/app/(app)/inventario/acciones';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MAX_COLOR, normalizarColor, textoColores } from '@/lib/esquemas/color';
import { avisar } from '@/lib/toast';

/** Un campo de color: sugiere los colores existentes (datalist y botones) y permite uno nuevo. */
function CampoColor({
  id,
  etiqueta,
  valor,
  onChange,
  sugerencias,
  error,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  sugerencias: string[];
  error?: string;
}) {
  const normalizado = normalizarColor(valor);
  const nuevo = normalizado !== '' && !sugerencias.includes(normalizado);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input
        id={id}
        list={`${id}-lista`}
        value={valor}
        maxLength={MAX_COLOR + 10}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={`${id}-ayuda`}
      />
      <datalist id={`${id}-lista`}>
        {sugerencias.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {sugerencias.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Colores existentes para ${etiqueta.toLowerCase()}`}>
          {sugerencias.map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={normalizado === c ? 'default' : 'outline'}
              aria-pressed={normalizado === c}
              onClick={() => onChange(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      )}
      <p id={`${id}-ayuda`} className={error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'} aria-live="polite">
        {error ?? (nuevo ? `Color nuevo: ${normalizado}` : '')}
      </p>
    </div>
  );
}

/**
 * D39: «Editar color» de una moto (primario obligatorio, secundario opcional). Se muestra solo a
 * quien puede editar (`puedeEditarColor`); la BD vuelve a validar y su error se muestra tal cual.
 */
export function EditarColor({
  vehicleId,
  vin,
  primario,
  secundario,
  sugerencias,
  compacto,
}: {
  vehicleId: string;
  vin: string;
  primario: string | null;
  secundario: string | null;
  sugerencias: string[];
  /** Solo el ícono (filas de tabla) */
  compacto?: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [p, setP] = useState(primario ?? '');
  const [s, setS] = useState(secundario ?? '');
  const [errores, setErrores] = useState<Record<string, string>>({});

  function abrir(a: boolean) {
    if (a) {
      setP(primario ?? '');
      setS(secundario ?? '');
      setErrores({});
    }
    setAbierto(a);
  }

  function guardar() {
    startTransition(async () => {
      const r = await editarColor(vehicleId, { primario: p, secundario: s });
      if (r.ok) {
        avisar(r, `Color de ${vin}: ${textoColores(r.datos.primario, r.datos.secundario)}`);
        setAbierto(false);
        router.refresh();
      } else {
        avisar(r);
        setErrores(r.campos ?? {});
      }
    });
  }

  const vistaPrevia = textoColores(normalizarColor(p) || null, normalizarColor(s) || null);

  return (
    <Dialog open={abierto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        {compacto ? (
          <Button variant="ghost" size="icon" aria-label={`Editar color de ${vin}`} title="Editar color">
            <Palette className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Palette className="size-4" aria-hidden /> Editar color
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar color</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{vin}</span> · se guarda en MAYÚSCULAS. Elige un color existente o escribe uno nuevo.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <CampoColor
            id={`${id}-primario`}
            etiqueta="Color primario (obligatorio)"
            valor={p}
            onChange={setP}
            sugerencias={sugerencias}
            error={errores.primario}
          />
          <CampoColor
            id={`${id}-secundario`}
            etiqueta="Color secundario (opcional)"
            valor={s}
            onChange={setS}
            sugerencias={sugerencias}
            error={errores.secundario}
          />
          <p className="text-sm">
            Quedará: <span className="font-medium">{vistaPrevia}</span>
          </p>
          <DialogFooter>
            {s !== '' && (
              <Button type="button" variant="outline" disabled={pendiente} onClick={() => setS('')}>
                Quitar secundario
              </Button>
            )}
            <Button type="submit" disabled={pendiente}>
              {pendiente ? 'Guardando…' : 'Guardar color'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
