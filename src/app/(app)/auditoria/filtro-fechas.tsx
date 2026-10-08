'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Rango de fechas (Lima) del reporte de márgenes: escribe ?desde=&hasta= en la URL. */
export function FiltroFechas() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function cambiar(clave: 'desde' | 'hasta', valor: string) {
    const sp = new URLSearchParams(params.toString());
    if (valor) sp.set(clave, valor);
    else sp.delete(clave);
    router.replace(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
      <div className="grid gap-1.5">
        <Label htmlFor="desde">Desde</Label>
        <Input id="desde" type="date" defaultValue={params.get('desde') ?? ''} onChange={(e) => cambiar('desde', e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="hasta">Hasta</Label>
        <Input id="hasta" type="date" defaultValue={params.get('hasta') ?? ''} onChange={(e) => cambiar('hasta', e.target.value)} />
      </div>
    </div>
  );
}
