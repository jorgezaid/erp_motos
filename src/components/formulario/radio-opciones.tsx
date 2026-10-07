'use client';

import { cn } from '@/lib/utils';

/** Grupo de opciones grandes (radio accesible con teclado), p. ej. el tipo de venta. */
export function RadioOpciones({
  nombre,
  valor,
  alCambiar,
  opciones,
  deshabilitado,
}: {
  nombre: string;
  valor: string;
  alCambiar: (v: string) => void;
  opciones: { valor: string; etiqueta: string; descripcion?: string }[];
  deshabilitado?: boolean;
}) {
  return (
    <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
      {opciones.map((o) => (
        <label
          key={o.valor}
          className={cn(
            'flex cursor-pointer flex-col gap-0.5 rounded-md border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
            deshabilitado && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="radio"
            name={nombre}
            value={o.valor}
            checked={valor === o.valor}
            disabled={deshabilitado}
            onChange={() => alCambiar(o.valor)}
            className="sr-only"
          />
          <span className="font-medium">{o.etiqueta}</span>
          {o.descripcion && <span className="text-muted-foreground">{o.descripcion}</span>}
        </label>
      ))}
    </div>
  );
}
