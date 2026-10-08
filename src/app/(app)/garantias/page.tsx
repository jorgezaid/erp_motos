import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Paginacion } from '@/components/tabla/paginacion';
import { exigirRol } from '@/lib/auth';
import { ESTADO_RECLAMO, opciones } from '@/lib/etiquetas';
import { leerParams } from '@/lib/tabla';
import { consultarGarantias, consultarReclamos, ESTADOS_GARANTIA } from './datos';
import { TablaGarantias, TablaReclamos } from './tablas';

export const metadata: Metadata = { title: 'Garantías · ERP Vehículos Eléctricos' };

type SP = Record<string, string | string[] | undefined>;

/**
 * /garantias (SPEC M7): búsqueda por VIN, DNI o RUC con cobertura, vigencia y días restantes;
 * registro de reclamos (todos) y seguimiento (admin y técnico).
 */
export default async function PaginaGarantias({ searchParams }: { searchParams: Promise<SP> }) {
  const sesion = await exigirRol();
  const sp = await searchParams;
  const params = leerParams(sp);
  const estadoReclamo = typeof sp.reclamo === 'string' ? sp.reclamo : '';
  const [{ filas, total }, reclamos] = await Promise.all([consultarGarantias(params), consultarReclamos(estadoReclamo)]);

  return (
    <>
      <Encabezado titulo="Garantías" descripcion="Busca por VIN, DNI o RUC. Solo las garantías vigentes admiten reclamos (RN-19)." />
      <BarraFiltros placeholder="VIN, DNI, RUC o nombre del cliente" estados={ESTADOS_GARANTIA} csvHref="/garantias/csv" />
      <TablaGarantias filas={filas} />
      <Paginacion pagina={params.pagina} total={total} searchParams={sp} />

      <section className="mt-10 grid gap-2" aria-labelledby="titulo-reclamos">
        <h2 id="titulo-reclamos" className="text-lg font-semibold">
          Reclamos
        </h2>
        <p className="text-sm text-muted-foreground">Abierto → en revisión → aprobado o rechazado → cerrado.</p>
        <BarraFiltros
          busqueda={false}
          extras={[{ param: 'reclamo', etiqueta: 'Estado del reclamo', opciones: opciones(ESTADO_RECLAMO) }]}
          csvHref="/garantias/csv?tipo=reclamos"
        />
        <TablaReclamos filas={reclamos} puedeAtender={sesion.rol !== 'vendedor'} />
      </section>
    </>
  );
}
