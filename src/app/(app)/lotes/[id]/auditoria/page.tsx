import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { alertasConciliacion, tieneAlertas } from '@/lib/auditoria';
import { claveLoteModelo, motosSinSerialRealPorLote } from '@/lib/consultas/provisionales';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { obtenerLote } from '../datos';

/** Pestaña Auditoría (SPEC M3): packing list vs DAM vs unidades registradas, con alertas en rojo. */
export default async function AuditoriaLote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lote = await obtenerLote(id);
  const supabase = await createClient();
  const [{ data: filas, error }, sinSerial] = await Promise.all([
    supabase.from('v_batch_reconciliation').select('*').eq('batch_id', lote.id).order('codigo_modelo'),
    motosSinSerialRealPorLote(lote.id),
  ]);
  if (error) throw new Error(error.message);
  const data = filas.map((f) => ({ ...f, motos_sin_serial_real: sinSerial.get(claveLoteModelo(f.batch_id, f.codigo_modelo)) ?? 0 }));
  const conAlertas = data.filter(tieneAlertas).length;
  // Una compra local (D41) no tiene DAM
  const conDam = lote.tipo_lote !== 'compra_local';

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {conAlertas > 0 ? (
          <Alert variant="destructive" className="max-w-2xl">
            <TriangleAlert />
            <AlertDescription>{conAlertas} modelo(s) con diferencias. Revisa las filas en rojo.</AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground">
            {data.length === 0 ? 'El lote no tiene packing list.' : conDam ? 'Sin diferencias entre packing list, DAM y unidades.' : 'Sin diferencias entre los ítems y las unidades.'}
          </p>
        )}
        <Button variant="outline" asChild>
          <a href={`/lotes/${lote.id}/auditoria/csv`} download>
            CSV
          </a>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead className="text-right">Packing list</TableHead>
              {conDam && <TableHead className="text-right">DAM</TableHead>}
              <TableHead className="text-right">Registradas</TableHead>
              <TableHead className="text-right">Baterías completas</TableHead>
              <TableHead className="text-right">Inspección aprobada</TableHead>
              <TableHead className="text-right">Sin serial real</TableHead>
              <TableHead>Alertas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((f) => {
              const alertas = alertasConciliacion(f);
              return (
                <TableRow
                  key={f.codigo_modelo}
                  className={cn(alertas.length > 0 && 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100')}
                  data-alerta={alertas.length > 0 || undefined}
                >
                  <TableCell className="font-medium">
                    {f.codigo_modelo} <span className="text-muted-foreground">({f.voltaje_sistema}V)</span>
                  </TableCell>
                  <TableCell className="text-right">{f.cantidad_packing_list}</TableCell>
                  {conDam && <TableCell className="text-right">{f.cantidad_dam ?? '—'}</TableCell>}
                  <TableCell className="text-right">{f.unidades_registradas}</TableCell>
                  <TableCell className="text-right">{f.unidades_baterias_completas}</TableCell>
                  <TableCell className="text-right">{f.unidades_inspeccion_aprobada}</TableCell>
                  <TableCell className="text-right">{f.motos_sin_serial_real}</TableCell>
                  <TableCell className="whitespace-normal">
                    {alertas.length === 0 ? '—' : <ul className="list-disc pl-4">{alertas.map((a) => <li key={a}>{a}</li>)}</ul>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
