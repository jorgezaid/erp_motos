import { exigirRol } from '@/lib/auth';
import { alertasConciliacion } from '@/lib/auditoria';
import { createClient } from '@/lib/supabase/server';
import { aCsv, respuestaCsv } from '@/lib/tabla';
import { obtenerLote } from '../../datos';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigirRol('admin');
  const { id } = await params;
  const lote = await obtenerLote(id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_batch_reconciliation')
    .select('*')
    .eq('batch_id', lote.id)
    .order('codigo_modelo');
  if (error) throw new Error(error.message);

  const csv = aCsv(data, [
    { encabezado: 'Modelo', valor: (f) => f.codigo_modelo },
    { encabezado: 'Packing list', valor: (f) => f.cantidad_packing_list },
    { encabezado: 'DAM', valor: (f) => f.cantidad_dam },
    { encabezado: 'Registradas', valor: (f) => f.unidades_registradas },
    { encabezado: 'Baterías completas', valor: (f) => f.unidades_baterias_completas },
    { encabezado: 'Inspección aprobada', valor: (f) => f.unidades_inspeccion_aprobada },
    { encabezado: 'Alertas', valor: (f) => alertasConciliacion(f).join(' | ') },
  ]);
  return respuestaCsv(csv, `auditoria-${lote.codigo_embarque}.csv`);
}
