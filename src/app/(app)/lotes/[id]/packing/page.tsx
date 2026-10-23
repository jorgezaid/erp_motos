import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/server';
import { obtenerLote, obtenerPacking } from '../datos';
import { TablaItems, type ItemVista } from './tabla-items';
import { TablaPacking, type LineaVista } from './tabla-packing';

/**
 * Pestaña Packing list (SPEC M3): modelos con cantidad del packing list y de la DAM, EXW y CBM.
 * En una compra local (D41) es la pestaña Ítems: modelo, cantidad y precio unitario.
 */
export default async function PackingLote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lote = await obtenerLote(id);
  const liquidado = lote.estado === 'liquidado';
  const supabase = await createClient();

  const [packing, { data: modelos }, { data: unidades }] = await Promise.all([
    obtenerPacking(lote.id),
    supabase
      .from('vehicle_models')
      .select('id, codigo_modelo, exw_usd_unitario, volumen_cbm_unitario')
      .eq('activo', true)
      .order('codigo_modelo'),
    supabase.from('vehicle_inventory').select('model_id').eq('batch_id', lote.id),
  ]);

  const registradas = new Map<string, number>();
  for (const u of unidades ?? []) registradas.set(u.model_id, (registradas.get(u.model_id) ?? 0) + 1);
  const enLote = new Set(packing.map((l) => l.model_id));
  const disponibles = (modelos ?? []).filter((m) => !enLote.has(m.id));

  // Compra local (D41): ítems con precio unitario en soles
  if (lote.tipo_lote === 'compra_local') {
    const items: ItemVista[] = packing.map((i) => ({
      id: i.id,
      model_id: i.model_id,
      codigo_modelo: i.codigo_modelo,
      cantidad_packing_list: i.cantidad_packing_list,
      precio_compra_unitario_pen: i.precio_compra_unitario_pen,
      registradas: registradas.get(i.model_id) ?? 0,
    }));
    return (
      <>
        {liquidado && (
          <Alert className="mb-4">
            <AlertDescription>La compra está liquidada: sus ítems no se pueden modificar (RN-08).</AlertDescription>
          </Alert>
        )}
        <TablaItems
          batchId={lote.id}
          items={items}
          disponibles={disponibles}
          liquidado={liquidado}
          incluyeIgv={lote.precio_incluye_igv}
        />
      </>
    );
  }

  const lineas: LineaVista[] = packing.map((i) => ({
    id: i.id,
    model_id: i.model_id,
    codigo_modelo: i.codigo_modelo,
    cantidad_packing_list: i.cantidad_packing_list,
    cantidad_dam: i.cantidad_dam,
    // En un lote de importación la BD exige EXW y CBM en la línea (guard_linea_lote, D41)
    exw_usd_unitario: i.exw_usd_unitario ?? 0,
    volumen_cbm_unitario: i.volumen_cbm_unitario ?? 0,
    registradas: registradas.get(i.model_id) ?? 0,
  }));

  return (
    <>
      {liquidado && (
        <Alert className="mb-4">
          <AlertDescription>El lote está liquidado: el packing list no se puede modificar (RN-08).</AlertDescription>
        </Alert>
      )}
      <TablaPacking
        batchId={lote.id}
        lineas={lineas}
        disponibles={disponibles}
        liquidado={liquidado}
      />
    </>
  );
}
