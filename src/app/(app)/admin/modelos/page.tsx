import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Paginacion } from '@/components/tabla/paginacion';
import { Button } from '@/components/ui/button';
import { exigirRol } from '@/lib/auth';
import { CATEGORIA, opciones } from '@/lib/etiquetas';
import { leerParams } from '@/lib/tabla';
import { consultarModelos, ESTADOS_MODELO } from './datos';
import { TablaModelos } from './tabla-modelos';

export const metadata: Metadata = { title: 'Modelos · ERP Vehículos Eléctricos' };

type SP = Record<string, string | string[] | undefined>;

export default async function PaginaModelos({ searchParams }: { searchParams: Promise<SP> }) {
  await exigirRol('admin');
  const sp = await searchParams;
  const params = leerParams(sp);
  const categoria = typeof sp.categoria === 'string' ? sp.categoria : '';
  const { filas, total } = await consultarModelos({ ...params, categoria });

  return (
    <>
      <Encabezado titulo="Modelos" descripcion="Catálogo con fichas técnicas. Las baterías se derivan del voltaje (RN-01).">
        <Button asChild>
          <Link href="/admin/modelos/nuevo">Nuevo modelo</Link>
        </Button>
      </Encabezado>
      <BarraFiltros
        placeholder="Buscar por código o nombre"
        estados={ESTADOS_MODELO}
        extras={[{ param: 'categoria', etiqueta: 'Categoría', opciones: opciones(CATEGORIA).map((o) => ({ valor: o.valor, etiqueta: o.etiqueta })) }]}
        csvHref="/admin/modelos/csv"
      />
      <TablaModelos filas={filas} />
      <Paginacion pagina={params.pagina} total={total} searchParams={sp} />
    </>
  );
}
