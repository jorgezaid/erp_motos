import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Decimal } from '@/lib/decimal';
import { estadoCosteo } from '@/lib/costing/estado-costeo';
import { calcularCostoTotalPen, calcularCostoUnitarioPen } from '@/lib/costing/prorrateo';
import { formatNumero, formatPEN, formatUSD } from '@/lib/format';
import { calcularMatrizPrecios, type TipoVenta } from '@/lib/pricing/precios';
import { createClient } from '@/lib/supabase/server';
import { obtenerLote, obtenerPacking } from '../datos';
import { BotonGuardarCosteo, BotonLiquidar, BotonReabrir } from './acciones-costeo';
import { costeoDelLote } from './calculo';

const n4 = (v: string) => formatNumero(v, 4);

/**
 * Pestaña Costeo (SPEC M3): vista previa del prorrateo (tabla de SPEC §7), costo unitario y
 * precios x1/x3/x6. Solo admin (la página y el RLS lo exigen).
 */
export default async function CosteoLote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lote = await obtenerLote(id);
  const liquidado = lote.estado === 'liquidado';
  const supabase = await createClient();

  const [items, { data: guardadas }, { data: margenes }, { data: precios }] = await Promise.all([
    obtenerPacking(lote.id),
    supabase.from('batch_model_costs').select('*').eq('batch_id', lote.id),
    supabase.from('price_margins').select('tipo_venta, cantidad_minima, margen_objetivo'),
    supabase.from('price_list').select('model_id, tipo_venta, precio_manual_pen').eq('batch_id', lote.id),
  ]);

  const costeo = costeoDelLote(lote, items);
  const estado = estadoCosteo(guardadas ?? [], costeo.ok ? costeo.filas : null);

  const manuales = new Map<string, Partial<Record<TipoVenta, number | null>>>();
  for (const p of precios ?? []) {
    manuales.set(p.model_id, { ...manuales.get(p.model_id), [p.tipo_venta]: p.precio_manual_pen });
  }
  const matriz =
    costeo.ok && (margenes?.length ?? 0) > 0
      ? calcularMatrizPrecios(
          costeo.filas.map((f) => ({
            model_id: f.model_id,
            codigo_modelo: f.codigo_modelo,
            costo_landing_unitario_pen: calcularCostoUnitarioPen(f),
            precios_manuales: manuales.get(f.model_id),
          })),
          margenes ?? [],
        )
      : [];
  const preciosDe = new Map(matriz.map((m) => [m.model_id, m.precios]));
  const totalLote = costeo.ok
    ? Decimal.sum(...costeo.filas.map((f) => calcularCostoTotalPen(f))).toFixed(2)
    : null;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Costeo guardado:</span>
        {estado === 'vigente' && <Badge variant="secondary">Vigente</Badge>}
        {estado === 'sin_costeo' && <Badge variant="outline">Sin guardar</Badge>}
        {estado === 'desactualizado' && <Badge variant="destructive">Desactualizado</Badge>}
        <div className="ml-auto flex flex-wrap gap-2">
          {liquidado ? (
            <BotonReabrir batchId={lote.id} codigo={lote.codigo_embarque} />
          ) : (
            <>
              <BotonGuardarCosteo batchId={lote.id} deshabilitado={!costeo.ok || estado === 'vigente'} />
              <BotonLiquidar batchId={lote.id} codigo={lote.codigo_embarque} deshabilitado={estado !== 'vigente'} />
            </>
          )}
        </div>
      </div>

      {!costeo.ok && (
        <Alert variant="destructive">
          <AlertTitle>No se puede calcular el costeo</AlertTitle>
          <AlertDescription>{costeo.error}</AlertDescription>
        </Alert>
      )}
      {costeo.ok && !liquidado && estado !== 'vigente' && (
        <Alert>
          <AlertDescription>
            Esta es una vista previa. Guarda el costeo para poder liquidar el lote (RN-07).
          </AlertDescription>
        </Alert>
      )}

      {costeo.ok && (
        <>
          <section className="grid gap-2">
            <h2 className="font-semibold">Prorrateo por modelo (SPEC §7)</h2>
            <div className="overflow-x-auto rounded-md border">
              <Table data-testid="tabla-costeo">
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">q</TableHead>
                    <TableHead className="text-right">FOB (US$)</TableHead>
                    <TableHead className="text-right">Impuestos (S/)</TableHead>
                    <TableHead className="text-right">Flete int. (US$)</TableHead>
                    <TableHead className="text-right">Agente (US$)</TableHead>
                    <TableHead className="text-right">Flete nac. (S/)</TableHead>
                    <TableHead className="text-right">Alquiler (S/)</TableHead>
                    <TableHead className="text-right">Sueldos (S/)</TableHead>
                    <TableHead className="text-right">Publicidad (S/)</TableHead>
                    <TableHead className="text-right">Armado (S/)</TableHead>
                    <TableHead className="text-right">Costo total</TableHead>
                    <TableHead className="text-right">Unitario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costeo.filas.map((f) => (
                    <TableRow key={f.model_id}>
                      <TableCell className="font-medium">{f.codigo_modelo}</TableCell>
                      <TableCell className="text-right">{f.cantidad}</TableCell>
                      <TableCell className="text-right">{n4(f.fob_asignado_usd)}</TableCell>
                      <TableCell className="text-right">{n4(f.impuestos_asignados_pen)}</TableCell>
                      <TableCell className="text-right">{n4(f.flete_internacional_asignado_usd)}</TableCell>
                      <TableCell className="text-right">{n4(f.gastos_agente_asignado_usd)}</TableCell>
                      <TableCell className="text-right">{n4(f.flete_nacional_asignado_pen)}</TableCell>
                      <TableCell className="text-right">{n4(f.alquiler_asignado_pen)}</TableCell>
                      <TableCell className="text-right">{n4(f.sueldos_asignado_pen)}</TableCell>
                      <TableCell className="text-right">{n4(f.publicidad_asignada_pen)}</TableCell>
                      <TableCell className="text-right">{n4(f.armado_pen)}</TableCell>
                      <TableCell className="text-right">{formatPEN(calcularCostoTotalPen(f))}</TableCell>
                      <TableCell className="text-right font-semibold" data-testid={`unitario-${f.codigo_modelo}`}>
                        {formatPEN(calcularCostoUnitarioPen(f))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={11}>
                      Costo total del lote (TC {formatNumero(lote.tipo_cambio, 4)} · FOB {formatUSD(lote.fob_total_usd)})
                    </TableCell>
                    <TableCell className="text-right font-semibold" data-testid="costo-total-lote">
                      {formatPEN(totalLote)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </section>

          <section className="grid gap-2">
            <h2 className="font-semibold">Precios de venta (SPEC §8)</h2>
            <p className="text-sm text-muted-foreground">
              Precio = costo unitario / (1 − margen). {liquidado ? 'Precios vigentes del lote.' : 'Se generan al liquidar.'}
            </p>
            <div className="overflow-x-auto rounded-md border">
              <Table data-testid="tabla-precios">
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Costo unitario</TableHead>
                    {(matriz[0]?.precios ?? []).map((p) => (
                      <TableHead key={p.tipo_venta} className="text-right">
                        x{p.cantidad_minima} ({formatNumero(new Decimal(p.margen_objetivo).times(100), 0)} %)
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costeo.filas.map((f) => (
                    <TableRow key={f.model_id}>
                      <TableCell className="font-medium">{f.codigo_modelo}</TableCell>
                      <TableCell className="text-right">{formatPEN(calcularCostoUnitarioPen(f))}</TableCell>
                      {(preciosDe.get(f.model_id) ?? []).map((p) => (
                        <TableCell key={p.tipo_venta} className="text-right" data-testid={`precio-${f.codigo_modelo}-${p.tipo_venta}`}>
                          {formatPEN(p.precio_venta_pen)}
                          {p.precio_manual_pen && (
                            <Badge variant="outline" className="ml-1">
                              manual
                            </Badge>
                          )}
                          <span className="block text-xs text-muted-foreground">utilidad {formatPEN(p.utilidad_pen)}</span>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
