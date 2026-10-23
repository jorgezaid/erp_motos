import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Paginacion } from '@/components/tabla/paginacion';
import { Button } from '@/components/ui/button';
import { exigirRol } from '@/lib/auth';
import { leerParams } from '@/lib/tabla';
import { consultarProveedores, ESTADOS_PROVEEDOR } from './datos';
import { DialogoProveedor } from './dialogo-proveedor';
import { TablaProveedores } from './tabla-proveedores';

export const metadata: Metadata = { title: 'Proveedores · ERP Vehículos Eléctricos' };

type SP = Record<string, string | string[] | undefined>;

/** /admin/proveedores (D41): proveedores de importación y de compras locales. */
export default async function PaginaProveedores({ searchParams }: { searchParams: Promise<SP> }) {
  await exigirRol('admin');
  const sp = await searchParams;
  const params = leerParams(sp);
  const { filas, total } = await consultarProveedores(params);

  return (
    <>
      <Encabezado titulo="Proveedores" descripcion="A quién se compran las motos: importación y compras locales.">
        <DialogoProveedor disparador={<Button>Nuevo proveedor</Button>} />
      </Encabezado>
      <BarraFiltros placeholder="Buscar por nombre, RUC o teléfono" estados={ESTADOS_PROVEEDOR} csvHref="/admin/proveedores/csv" />
      <TablaProveedores filas={filas} />
      <Paginacion pagina={params.pagina} total={total} searchParams={sp} />
    </>
  );
}
