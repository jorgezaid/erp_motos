import { Alert, AlertDescription } from '@/components/ui/alert';
import type { EntradaCostosLote } from '@/lib/esquemas/lote';
import { createClient } from '@/lib/supabase/server';
import { BotonReabrir } from '../costeo/acciones-costeo';
import { obtenerLote } from '../datos';
import { FormularioCostos } from './formulario-costos';

const texto = (v: number | null) => (v === null ? '' : String(v));

/** Pestaña Costos (SPEC M3): bloques USD, SUNAT (con el interruptor RN-05) y nacionales. */
export default async function CostosLote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lote = await obtenerLote(id);
  const liquidado = lote.estado === 'liquidado';

  const supabase = await createClient();
  const { count } = await supabase
    .from('batch_model_costs')
    .select('model_id', { count: 'exact', head: true })
    .eq('batch_id', lote.id);

  const inicial: EntradaCostosLote = {
    tipo_cambio: texto(lote.tipo_cambio),
    fob_total_usd: texto(lote.fob_total_usd),
    flete_internacional_usd: texto(lote.flete_internacional_usd),
    gastos_agente_usd: texto(lote.gastos_agente_usd),
    ad_valorem_pen: texto(lote.ad_valorem_pen),
    igv_pen: texto(lote.igv_pen),
    ipm_pen: texto(lote.ipm_pen),
    percepcion_pen: texto(lote.percepcion_pen),
    impuestos_recuperables_al_costo: lote.impuestos_recuperables_al_costo,
    flete_nacional_pen: texto(lote.flete_nacional_pen),
    alquiler_periodo_pen: texto(lote.alquiler_periodo_pen),
    sueldos_periodo_pen: texto(lote.sueldos_periodo_pen),
    publicidad_inicial_pen: texto(lote.publicidad_inicial_pen),
    costo_armado_unitario_pen: texto(lote.costo_armado_unitario_pen),
  };

  return (
    <>
      {liquidado && (
        <Alert className="mb-6 max-w-4xl">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>El lote está liquidado: sus costos están congelados (RN-08). Reábrelo para editarlos.</span>
            <BotonReabrir batchId={lote.id} codigo={lote.codigo_embarque} />
          </AlertDescription>
        </Alert>
      )}
      <FormularioCostos id={lote.id} inicial={inicial} liquidado={liquidado} hayCosteo={(count ?? 0) > 0} />
    </>
  );
}
