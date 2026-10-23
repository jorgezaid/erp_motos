'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const PESTANAS = [
  { ruta: '', etiqueta: 'Datos' },
  { ruta: '/costos', etiqueta: 'Costos' },
  { ruta: '/packing', etiqueta: 'Packing list' },
  { ruta: '/costeo', etiqueta: 'Costeo' },
  { ruta: '/unidades', etiqueta: 'Unidades' },
  { ruta: '/auditoria', etiqueta: 'Auditoría' },
];

/**
 * Pestañas de /lotes/[id] (SPEC M3) como enlaces: cada una es una ruta renderizada en el servidor.
 * En una compra local (D41) el packing list se llama «Ítems» (misma ruta).
 */
export function PestanasLote({ id, compraLocal }: { id: string; compraLocal: boolean }) {
  const pathname = usePathname();
  const base = `/lotes/${id}`;
  return (
    <nav aria-label="Secciones del lote" className="mb-6 flex gap-1 overflow-x-auto border-b">
      {PESTANAS.map((p) => ({ ...p, etiqueta: compraLocal && p.ruta === '/packing' ? 'Ítems' : p.etiqueta })).map((p) => {
        const href = `${base}${p.ruta}`;
        const activa = pathname === href;
        return (
          <Link
            key={p.ruta}
            href={href}
            aria-current={activa ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap',
              activa ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {p.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
