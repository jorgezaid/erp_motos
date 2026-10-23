import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Paginacion } from '@/components/tabla/paginacion';
import { exigirRol } from '@/lib/auth';
import { opcionesProveedores } from '@/lib/consultas/proveedores';
import { ESTADO_LOTE, opciones, TIPO_LOTE } from '@/lib/etiquetas';
import { leerParams } from '@/lib/tabla';
import { consultarLotes } from './datos';
import { DialogoCompraLocal } from './dialogo-compra-local';
import { DialogoNuevoLote } from './dialogo-nuevo-lote';
import { TablaLotes } from './tabla-lotes';

export const metadata: Metadata = { title: 'Lotes · ERP Vehículos Eléctricos' };

type SP = Record<string, string | string[] | undefined>;

export default async function PaginaLotes({ searchParams }: { searchParams: Promise<SP> }) {
  await exigirRol('admin');
  const sp = await searchParams;
  const params = leerParams(sp);
  const proveedor = typeof sp.proveedor === 'string' ? sp.proveedor : '';
  const origen = typeof sp.origen === 'string' ? sp.origen : '';
  const [{ filas, total }, proveedores] = await Promise.all([
    consultarLotes({ ...params, proveedor, origen }),
    opcionesProveedores(),
  ]);

  return (
    <>
      <Encabezado
        titulo="Lotes"
        descripcion="Importaciones (cada contenedor) y compras locales, con sus costos, costeo y unidades."
      >
        <DialogoCompraLocal proveedores={proveedores} />
        <DialogoNuevoLote proveedores={proveedores} />
      </Encabezado>
      <BarraFiltros
        placeholder="Buscar por código, DAM, factura o proveedor"
        estados={opciones(ESTADO_LOTE)}
        extras={[
          { param: 'origen', etiqueta: 'Origen', opciones: opciones(TIPO_LOTE) },
          { param: 'proveedor', etiqueta: 'Proveedor', opciones: proveedores },
        ]}
        csvHref="/lotes/csv"
      />
      <TablaLotes filas={filas} />
      <Paginacion pagina={params.pagina} total={total} searchParams={sp} />
    </>
  );
}
