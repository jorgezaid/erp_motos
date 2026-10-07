import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Paginacion } from '@/components/tabla/paginacion';
import { exigirRol } from '@/lib/auth';
import { ESTADO_LOTE, opciones } from '@/lib/etiquetas';
import { leerParams } from '@/lib/tabla';
import { consultarLotes } from './datos';
import { DialogoNuevoLote } from './dialogo-nuevo-lote';
import { TablaLotes } from './tabla-lotes';

export const metadata: Metadata = { title: 'Lotes · ERP Vehículos Eléctricos' };

type SP = Record<string, string | string[] | undefined>;

export default async function PaginaLotes({ searchParams }: { searchParams: Promise<SP> }) {
  await exigirRol('admin');
  const sp = await searchParams;
  const params = leerParams(sp);
  const { filas, total } = await consultarLotes(params);

  return (
    <>
      <Encabezado titulo="Lotes de importación" descripcion="Cada contenedor con sus costos, packing list, costeo y unidades.">
        <DialogoNuevoLote />
      </Encabezado>
      <BarraFiltros
        placeholder="Buscar por código, DAM o proveedor"
        estados={opciones(ESTADO_LOTE)}
        csvHref="/lotes/csv"
      />
      <TablaLotes filas={filas} />
      <Paginacion pagina={params.pagina} total={total} searchParams={sp} />
    </>
  );
}
