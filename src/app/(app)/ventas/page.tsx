import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Paginacion } from '@/components/tabla/paginacion';
import { Button } from '@/components/ui/button';
import { exigirRol } from '@/lib/auth';
import { ESTADO_ORDEN, opciones, TIPO_VENTA } from '@/lib/etiquetas';
import { leerParams } from '@/lib/tabla';
import { consultarVentas } from './datos';
import { TablaVentas } from './tabla-ventas';

export const metadata: Metadata = { title: 'Ventas · ERP Vehículos Eléctricos' };

type SP = Record<string, string | string[] | undefined>;

/** /ventas (SPEC M6): órdenes con búsqueda por número, cliente o documento. */
export default async function PaginaVentas({ searchParams }: { searchParams: Promise<SP> }) {
  const sesion = await exigirRol('admin', 'vendedor');
  const sp = await searchParams;
  const params = leerParams(sp);
  const tipo = typeof sp.tipo === 'string' ? sp.tipo : '';
  const mios = sp.mios === '1' ? '1' : '';
  const { filas, total } = await consultarVentas({ ...params, tipo, mios }, { userId: sesion.userId, esAdmin: sesion.rol === 'admin' });
  const misBorradores = mios === '1' && params.estado === 'borrador';

  return (
    <>
      <Encabezado titulo="Ventas" descripcion="Órdenes de venta: borradores, confirmadas y anuladas.">
        <Button asChild variant={misBorradores ? 'secondary' : 'outline'} aria-pressed={misBorradores}>
          <Link href={misBorradores ? '/ventas' : '/ventas?estado=borrador&mios=1'}>Mis borradores</Link>
        </Button>
        <Button asChild>
          <Link href="/ventas/nueva">Nueva venta</Link>
        </Button>
      </Encabezado>
      <BarraFiltros
        placeholder="Buscar por n.º, cliente o documento"
        estados={opciones(ESTADO_ORDEN)}
        extras={[{ param: 'tipo', etiqueta: 'Escala', opciones: opciones(TIPO_VENTA) }]}
        csvHref="/ventas/csv"
      />
      <TablaVentas filas={filas} />
      <Paginacion pagina={params.pagina} total={total} searchParams={sp} />
    </>
  );
}
