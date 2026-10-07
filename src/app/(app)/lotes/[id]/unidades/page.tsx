import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Paginacion } from '@/components/tabla/paginacion';
import { consultarStock, textoInspeccion } from '@/lib/consultas/stock';
import { ESTADO_UNIDAD, opciones } from '@/lib/etiquetas';
import { createClient } from '@/lib/supabase/server';
import { leerParams } from '@/lib/tabla';
import { obtenerLote } from '../datos';
import { TablaUnidades, type UnidadLote } from './tabla-unidades';

type SP = Record<string, string | string[] | undefined>;

/** Pestaña Unidades (SPEC M3): seriales registrados del lote, con su costo landing (solo admin). */
export default async function UnidadesLote({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const lote = await obtenerLote(id);
  const filtros = leerParams(sp);
  const { filas, total } = await consultarStock({ ...filtros, batchId: lote.id });

  // Costo landing por unidad: v_vehicle_costs (solo admin por RLS; esta página exige admin)
  const supabase = await createClient();
  const ids = filas.map((f) => f.vehicle_id).filter((v): v is string => !!v);
  const { data: costos } = ids.length
    ? await supabase.from('v_vehicle_costs').select('vehicle_id, costo_landing_calculado_pen').in('vehicle_id', ids)
    : { data: [] };
  const costo = new Map((costos ?? []).map((c) => [c.vehicle_id, c.costo_landing_calculado_pen]));

  const unidades: UnidadLote[] = filas.map((f) => ({
    vehicle_id: f.vehicle_id ?? '',
    vin_chasis: f.vin_chasis ?? '',
    nro_motor: f.nro_motor ?? '',
    codigo_modelo: f.codigo_modelo ?? '',
    colores: [f.color_primario, f.color_secundario].filter(Boolean).join(' / ') || '—',
    estado: f.estado ?? 'en_caja',
    ubicacion: f.ubicacion ?? '—',
    baterias: `${f.baterias_registradas ?? 0}/${f.cantidad_baterias_12v ?? 0}`,
    inspeccion: textoInspeccion(f.ultima_inspeccion_aprobada),
    costo: costo.get(f.vehicle_id) ?? null,
  }));

  return (
    <>
      <BarraFiltros
        placeholder="Buscar por VIN, motor o modelo"
        estados={opciones(ESTADO_UNIDAD)}
        csvHref={`/lotes/${lote.id}/unidades/csv`}
      />
      <TablaUnidades filas={unidades} />
      <Paginacion pagina={filtros.pagina} total={total} searchParams={sp} />
    </>
  );
}
