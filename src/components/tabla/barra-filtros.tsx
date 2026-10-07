'use client';

import { Download, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type OpcionFiltro = { valor: string; etiqueta: string };
export type FiltroExtra = { param: string; etiqueta: string; opciones: OpcionFiltro[] };

const TODOS = '__todos__';

/**
 * Búsqueda + filtros por estado (y otros) + exportación a CSV (SPEC §10).
 * Escribe los filtros en la URL; la página (Server Component) consulta con ellos.
 */
export function BarraFiltros({
  placeholder = 'Buscar…',
  estados,
  extras = [],
  csvHref,
}: {
  placeholder?: string;
  estados?: OpcionFiltro[];
  extras?: FiltroExtra[];
  /** Ruta del Route Handler que exporta el CSV con los mismos filtros */
  csvHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [, startTransition] = useTransition();
  const primera = useRef(true);
  // Última consulta pedida: si se cambian dos filtros antes de que termine la navegación,
  // el segundo cambio parte del primero (y no de la URL anterior)
  const ultima = useRef(params.toString());
  useEffect(() => {
    ultima.current = params.toString();
  }, [params]);

  function aplicar(cambios: Record<string, string | null>) {
    const sp = new URLSearchParams(ultima.current);
    for (const [k, v] of Object.entries(cambios)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete('pagina');
    const s = sp.toString();
    ultima.current = s;
    startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname));
  }

  // Búsqueda con espera de 300 ms
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const t = setTimeout(() => aplicar({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtros: FiltroExtra[] = [...(estados ? [{ param: 'estado', etiqueta: 'Estado', opciones: estados }] : []), ...extras];
  const csv = csvHref ? `${csvHref}${params.toString() ? `?${params.toString()}` : ''}` : null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Buscar"
          className="pl-8"
        />
      </div>
      {filtros.map((f) => (
        <Select
          key={f.param}
          value={params.get(f.param) ?? TODOS}
          onValueChange={(v) => aplicar({ [f.param]: v === TODOS ? null : v })}
        >
          <SelectTrigger className="w-48" aria-label={f.etiqueta}>
            <SelectValue placeholder={f.etiqueta} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>{f.etiqueta}: todos</SelectItem>
            {f.opciones.map((o) => (
              <SelectItem key={o.valor} value={o.valor}>
                {o.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {csv && (
        <Button variant="outline" asChild>
          <a href={csv} download>
            <Download className="size-4" aria-hidden />
            CSV
          </a>
        </Button>
      )}
    </div>
  );
}
