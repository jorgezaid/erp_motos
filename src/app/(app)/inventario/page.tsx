import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Paginacion } from '@/components/tabla/paginacion';
import { Button } from '@/components/ui/button';
import { exigirRol } from '@/lib/auth';
import { leerIdentidadModelos, modeloDeFila } from '@/lib/consultas/modelos';
import { opcionesProveedores } from '@/lib/consultas/proveedores';
import { consultarStock, OPCION_FILTRO_BATERIAS, OPCION_FILTRO_ORIGEN, textoInspeccion } from '@/lib/consultas/stock';
import { puedeEditarColor } from '@/lib/esquemas/color';
import { puedeMoverUnidad } from '@/lib/esquemas/mover';
import { ESTADO_UNIDAD, opciones } from '@/lib/etiquetas';
import { puedeVer } from '@/lib/roles';
import { leerParams } from '@/lib/tabla';
import { leerFiltrosInventario, opcionesFiltroInventario, ubicacionesActivas } from './datos';
import { TablaInventario, type FilaInventario } from './tabla-inventario';

export const metadata: Metadata = { title: 'Inventario · ERP Vehículos Eléctricos' };

type SP = Record<string, string | string[] | undefined>;

/** /inventario (SPEC M4): stock por número de serie sobre v_stock (sin costos). */
export default async function PaginaInventario({ searchParams }: { searchParams: Promise<SP> }) {
  const sesion = await exigirRol();
  const sp = await searchParams;
  const params = leerParams(sp);
  const extra = leerFiltrosInventario(sp, sesion.rol);
  const moverMotos = sesion.rol === 'admin' || sesion.rol === 'tecnico';
  const admin = sesion.rol === 'admin';
  const [{ filas, total }, op, modelos, ubicaciones, proveedores] = await Promise.all([
    consultarStock({ ...params, ...extra }),
    opcionesFiltroInventario(),
    leerIdentidadModelos(),
    moverMotos ? ubicacionesActivas() : null,
    // D41: el filtro por proveedor solo existe para el admin (ni la consulta se hace para otro rol)
    admin ? opcionesProveedores() : null,
  ]);

  const unidades: FilaInventario[] = filas.map((f) => ({
    vehicle_id: f.vehicle_id ?? '',
    vin_chasis: f.vin_chasis ?? '',
    nro_motor: f.nro_motor ?? '',
    codigo_modelo: f.codigo_modelo ?? '',
    modelo: modeloDeFila(f, modelos),
    colores: [f.color_primario, f.color_secundario].filter(Boolean).join(' / ') || '—',
    color_primario: f.color_primario,
    color_secundario: f.color_secundario,
    editarColor: puedeEditarColor(sesion.rol, f.estado ?? 'en_caja'),
    estado: f.estado ?? 'en_caja',
    ubicacion: f.ubicacion ?? '—',
    ubicacion_id: f.location_id,
    mover: puedeMoverUnidad(sesion.rol, f.estado ?? 'en_caja'),
    baterias: `${f.baterias_registradas ?? 0}/${f.cantidad_baterias_12v ?? 0}`,
    provisionales: f.baterias_provisionales,
    inspeccion: textoInspeccion(f.ultima_inspeccion_aprobada),
    precio_x1: f.precio_x1,
    precio_x3: f.precio_x3,
    precio_x6: f.precio_x6,
  }));

  return (
    <>
      <Encabezado titulo="Inventario" descripcion="Unidades por número de serie: estado, ubicación, baterías e inspección.">
        {puedeVer('/inventario/registro', sesion.rol) && (
          <Button asChild>
            <Link href="/inventario/registro">Registrar unidades</Link>
          </Button>
        )}
      </Encabezado>
      <BarraFiltros
        placeholder="Buscar por VIN, motor o modelo"
        estados={opciones(ESTADO_UNIDAD)}
        extras={[
          { param: 'modelo', etiqueta: 'Modelo', opciones: op.modelos },
          { param: 'ubicacion', etiqueta: 'Ubicación', opciones: op.ubicaciones },
          { param: 'color', etiqueta: 'Color', opciones: op.colores },
          OPCION_FILTRO_BATERIAS,
          OPCION_FILTRO_ORIGEN,
          ...(proveedores ? [{ param: 'proveedor', etiqueta: 'Proveedor', opciones: proveedores }] : []),
        ]}
        csvHref="/inventario/csv"
      />
      <TablaInventario
        filas={unidades}
        verPrecios={sesion.rol !== 'tecnico'}
        enlaceTaller={puedeVer('/taller', sesion.rol)}
        coloresExistentes={op.colores.map((c) => c.valor)}
        ubicaciones={ubicaciones}
      />
      <Paginacion pagina={params.pagina} total={total} searchParams={sp} />
    </>
  );
}
