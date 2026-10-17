import { Bike, CircleHelp, Truck, UsersRound, type LucideIcon } from 'lucide-react';
import { ESTILO_CATEGORIA, textoCategoria, textoEnergia, textoPotencia, type Categoria, type DatosModelo } from '@/lib/modelos';
import { cn } from '@/lib/utils';

const ICONO: Record<Categoria, LucideIcon> = {
  bicimoto: Bike,
  trimoto_pasajeros: UsersRound,
  trimoto_carga: Truck,
};

const SIN_CATEGORIA = 'bg-muted text-muted-foreground border-border';

/** Ícono de la categoría en un recuadro de color (va donde algún día irá la foto del modelo). */
export function IconoCategoria({ categoria, className }: { categoria: Categoria | null; className?: string }) {
  const Icono = categoria ? ICONO[categoria] : CircleHelp;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border',
        categoria ? ESTILO_CATEGORIA[categoria] : SIN_CATEGORIA,
        className,
      )}
      aria-hidden
    >
      <Icono className="size-1/2" />
    </span>
  );
}

/** Categoría como etiqueta: ícono + texto + color (se entiende también sin color). */
export function EtiquetaCategoria({ categoria, className }: { categoria: Categoria | null; className?: string }) {
  const Icono = categoria ? ICONO[categoria] : CircleHelp;
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        categoria ? ESTILO_CATEGORIA[categoria] : SIN_CATEGORIA,
        className,
      )}
    >
      <Icono className="size-3.5" aria-hidden />
      {textoCategoria(categoria)}
    </span>
  );
}

/**
 * Identidad del modelo (SPEC M2/M4): código y nombre comercial, categoría (ícono + texto + color),
 * voltaje y baterías destacados y potencia. `compacto` para filas y tarjetas; `grande` para la
 * ficha de la moto en el taller.
 */
export function IdentidadModelo({
  modelo,
  tamano = 'compacto',
  className,
}: {
  modelo: DatosModelo;
  tamano?: 'compacto' | 'grande';
  className?: string;
}) {
  const grande = tamano === 'grande';
  const potencia = textoPotencia(modelo.potencia_motor_watts);
  return (
    <div className={cn('flex min-w-0 items-center', grande ? 'gap-4' : 'gap-2.5', className)} data-testid="identidad-modelo">
      <IconoCategoria categoria={modelo.categoria} className={grande ? 'size-16' : 'size-10'} />
      <div className="grid min-w-0 gap-1">
        <p className={cn('flex flex-wrap items-baseline gap-x-2 leading-tight', grande ? 'text-2xl' : 'text-sm')}>
          <span className="font-semibold">{modelo.codigo_modelo ?? '—'}</span>
          {modelo.nombre_comercial && (
            <span className={cn('text-muted-foreground', grande ? 'text-base' : 'text-xs')}>{modelo.nombre_comercial}</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <EtiquetaCategoria categoria={modelo.categoria} />
          <span className={cn('font-semibold tabular-nums', grande ? 'text-lg' : 'text-xs')}>{textoEnergia(modelo)}</span>
          {potencia && <span className={cn('text-muted-foreground tabular-nums', grande ? 'text-sm' : 'text-xs')}>{potencia}</span>}
        </div>
      </div>
    </div>
  );
}
