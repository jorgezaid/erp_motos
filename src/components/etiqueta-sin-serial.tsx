import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * D37: la moto tiene baterías con serial provisional (PROV-) de «Listo rápido». Ícono + texto
 * (no depende del color); el título dice cuántas.
 */
export function EtiquetaSinSerial({ cantidad, className }: { cantidad: number; className?: string }) {
  if (cantidad <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
        className,
      )}
      title={`${cantidad} ${cantidad === 1 ? 'batería con serial provisional' : 'baterías con serial provisional'}`}
    >
      <TriangleAlert className="size-3.5" aria-hidden />
      Baterías sin serial real
    </span>
  );
}
