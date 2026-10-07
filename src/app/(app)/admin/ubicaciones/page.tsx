import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Paginacion } from '@/components/tabla/paginacion';
import { Button } from '@/components/ui/button';
import { exigirRol } from '@/lib/auth';
import { opciones, TIPO_UBICACION } from '@/lib/etiquetas';
import { leerParams } from '@/lib/tabla';
import { consultarUbicaciones, ESTADOS_UBICACION } from './datos';
import { DialogoUbicacion } from './dialogo-ubicacion';
import { TablaUbicaciones } from './tabla-ubicaciones';

export const metadata: Metadata = { title: 'Ubicaciones · ERP Vehículos Eléctricos' };

type SP = Record<string, string | string[] | undefined>;

export default async function PaginaUbicaciones({ searchParams }: { searchParams: Promise<SP> }) {
  await exigirRol('admin');
  const sp = await searchParams;
  const params = leerParams(sp);
  const tipo = typeof sp.tipo === 'string' ? sp.tipo : '';
  const { filas, total } = await consultarUbicaciones({ ...params, tipo });

  return (
    <>
      <Encabezado titulo="Ubicaciones" descripcion="Almacenes, showrooms y talleres donde puede estar cada unidad.">
        <DialogoUbicacion disparador={<Button>Nueva ubicación</Button>} />
      </Encabezado>
      <BarraFiltros
        placeholder="Buscar por nombre o dirección"
        estados={ESTADOS_UBICACION}
        extras={[{ param: 'tipo', etiqueta: 'Tipo', opciones: opciones(TIPO_UBICACION) }]}
        csvHref="/admin/ubicaciones/csv"
      />
      <TablaUbicaciones filas={filas} />
      <Paginacion pagina={params.pagina} total={total} searchParams={sp} />
    </>
  );
}
