import { exigirRol } from '@/lib/auth';
import { alertasConciliacion } from '@/lib/auditoria';
import { claveLoteModelo, motosSinSerialRealPorLote } from '@/lib/consultas/provisionales';
import { createClient } from '@/lib/supabase/server';
import { aCsv, respuestaCsv } from '@/lib/tabla';
import { obtenerLote } from '../../datos';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigirRol('admin');
  const { id } = await params;
  const lote = await obtenerLote(id);
  const supabase = await createClient();
  const [{ data: filas, error }, sinSerial] = await Promise.all([
    supabase.from('v_batch_reconciliation').select('*').eq('batch_id', lote.id).order('codigo_modelo'),
    motosSinSerialRealPorLote(lote.id),
  ]);
  if (error) throw new Error(error.message);
  const data = filas.map((f) => ({ ...f, motos_sin_serial_real: sinSerial.get(claveLoteModelo(f.batch_id, f.codigo_modelo)) ?? 0 }));

  const csv = aCsv(data, [
    { encabezado: 'Modelo', valor: (f) => f.codigo_modelo },
    { encabezado: 'Packing list', valor: (f) => f.cantidad_packing_list },
    { encabezado: 'DAM', valor: (f) => f.cantidad_dam },
    { encabezado: 'Registradas', valor: (f) => f.unidades_registradas },
    { encabezado: 'Baterías completas', valor: (f) => f.unidades_baterias_completas },
    { encabezado: 'Inspección aprobada', valor: (f) => f.unidades_inspeccion_aprobada },
    { encabezado: 'Baterías sin serial real (unidades)', valor: (f) => f.motos_sin_serial_real },
    { encabezado: 'Alertas', valor: (f) => alertasConciliacion(f).join(' | ') },
  ]);
  return respuestaCsv(csv, `auditoria-${lote.codigo_embarque}.csv`);
}
