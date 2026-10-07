import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FILAS_POR_PAGINA } from '@/lib/tabla';

/** Paginación del servidor: conserva los demás filtros de la URL. */
export function Paginacion({
  pagina,
  total,
  searchParams,
  porPagina = FILAS_POR_PAGINA,
}: {
  pagina: number;
  total: number;
  searchParams: Record<string, string | string[] | undefined>;
  porPagina?: number;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  function href(p: number) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      const valor = Array.isArray(v) ? v[0] : v;
      if (valor && k !== 'pagina') sp.set(k, valor);
    }
    if (p > 1) sp.set('pagina', String(p));
    const s = sp.toString();
    return s ? `?${s}` : '?';
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground print:hidden">
      <span>
        {total === 0 ? 'Sin resultados' : `Mostrando ${desde}–${hasta} de ${total}`}
      </span>
      {paginas > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild={pagina > 1} disabled={pagina <= 1}>
            {pagina > 1 ? <Link href={href(pagina - 1)}>Anterior</Link> : <span>Anterior</span>}
          </Button>
          <span>
            Página {pagina} de {paginas}
          </span>
          <Button variant="outline" size="sm" asChild={pagina < paginas} disabled={pagina >= paginas}>
            {pagina < paginas ? <Link href={href(pagina + 1)}>Siguiente</Link> : <span>Siguiente</span>}
          </Button>
        </div>
      )}
    </div>
  );
}
