import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { exigirRol } from '@/lib/auth';
import { alertasConciliacion, tieneAlertas } from '@/lib/auditoria';
import { anchoRelativo, inicioMesLima, resumirVentas, utilidadDelMes } from '@/lib/dashboard';
import { ESTADO_UNIDAD } from '@/lib/etiquetas';
import { formatPEN, formatPorcentaje, hoyLima } from '@/lib/format';
import { etiquetaMes } from '@/lib/gastos';
import { cn } from '@/lib/utils';
import { rangoLima, totalMargen } from '@/lib/margenes';
import { ETIQUETA_ROL } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { MAX_FILAS_CSV } from '@/lib/tabla';
import { avisoBorradores } from '@/lib/ventas';
import type { Database } from '@/types/database';

type Estado = Database['public']['Enums']['vehicle_status'];
const ESTADOS = Object.keys(ESTADO_UNIDAD) as Estado[];

function Indicador({ etiqueta, valor, detalle, testId }: { etiqueta: string; valor: string; detalle?: string; testId: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="grid gap-1 px-4">
        <p className="text-sm text-muted-foreground">{etiqueta}</p>
        <p className="text-2xl font-semibold" data-testid={testId}>
          {valor}
        </p>
        {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Dashboard (SPEC M8): unidades por estado (todos), ventas del día y del mes (admin y vendedor),
 * margen promedio y alertas de conciliación (solo admin: usan costos y lotes).
 */
export default async function Inicio() {
  const sesion = await exigirRol();
  const supabase = await createClient();
  const esAdmin = sesion.rol === 'admin';
  const veVentas = sesion.rol !== 'tecnico';
  const dia = rangoLima(hoyLima(), null).desde ?? '';
  const inicioMes = inicioMesLima();
  const mes = rangoLima(inicioMes, null).desde ?? '';

  const [conteos, ventasMes, margenes, conciliacion, utilidadMes, misBorradores] = await Promise.all([
    Promise.all(
      ESTADOS.map(async (e) => {
        const { count } = await supabase.from('vehicle_inventory').select('id', { count: 'exact', head: true }).eq('estado', e);
        return [e, count ?? 0] as const;
      }),
    ),
    veVentas
      ? supabase.from('sales_orders').select('confirmada_at, total_pen').eq('estado', 'confirmada').gte('confirmada_at', mes).limit(MAX_FILAS_CSV)
      : Promise.resolve({ data: [] }),
    esAdmin
      ? supabase.from('v_sales_margin').select('*').gte('confirmada_at', mes).limit(MAX_FILAS_CSV)
      : Promise.resolve({ data: [] }),
    esAdmin ? supabase.from('v_batch_reconciliation').select('*').limit(MAX_FILAS_CSV) : Promise.resolve({ data: [] }),
    esAdmin ? supabase.from('v_utilidad_mensual').select('*').eq('mes', inicioMes).maybeSingle() : Promise.resolve({ data: null }),
    veVentas
      ? supabase
          .from('sales_orders')
          .select('created_at, order_items(count)')
          .eq('estado', 'borrador')
          .eq('vendedor_id', sesion.userId)
          .eq('order_items.activo', true)
          .limit(MAX_FILAS_CSV)
      : Promise.resolve({ data: [] }),
  ]);

  const porEstado = new Map(conteos);
  const maximo = Math.max(...conteos.map(([, n]) => n), 0);
  const ventas = ventasMes.data ?? [];
  const hoy = resumirVentas(ventas, dia);
  const delMes = resumirVentas(ventas, mes);
  const margen = totalMargen(margenes.data ?? []);
  const alertas = (conciliacion.data ?? []).filter(tieneAlertas);
  const utilidad = utilidadDelMes(utilidadMes.data);
  const mesTexto = etiquetaMes(inicioMes.slice(0, 7));
  const borradores = avisoBorradores((misBorradores.data ?? []).map((b) => ({ created_at: b.created_at, motos: b.order_items[0]?.count ?? 0 })));

  return (
    <>
      <Encabezado titulo={`Hola, ${sesion.nombre || sesion.email}`} descripcion={`Rol: ${ETIQUETA_ROL[sesion.rol]}`} />

      {borradores && (
        <Alert className="mb-6">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3" data-testid="aviso-borradores">
            <span>{borradores}</span>
            <Link href="/ventas?estado=borrador&mios=1" className="font-medium text-foreground underline">
              Ver mis borradores
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <section aria-label="Indicadores" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          etiqueta="Listas en tienda"
          valor={String(porEstado.get('listo_en_tienda') ?? 0)}
          detalle={`${(porEstado.get('en_caja') ?? 0) + (porEstado.get('en_ensamble') ?? 0)} en taller`}
          testId="kpi-tienda"
        />
        {veVentas && (
          <>
            <Indicador etiqueta="Ventas de hoy" valor={formatPEN(hoy.total)} detalle={`${hoy.cantidad} venta(s) confirmada(s)`} testId="kpi-hoy" />
            <Indicador
              etiqueta="Ventas del mes"
              valor={formatPEN(delMes.total)}
              detalle={`${delMes.cantidad} venta(s) confirmada(s)`}
              testId="kpi-mes"
            />
          </>
        )}
        {esAdmin && (
          <Indicador
            etiqueta="Margen real del mes"
            valor={margen.margen === null ? '—' : formatPorcentaje(margen.margen, 1)}
            detalle={`Utilidad ${formatPEN(margen.utilidad)} sobre ${formatPEN(margen.venta)}`}
            testId="kpi-margen"
          />
        )}
      </section>

      {esAdmin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Utilidad neta · {mesTexto}</CardTitle>
            <CardDescription>
              Ventas confirmadas del mes menos el costo landing de lo vendido y los gastos realizados. Los gastos no cambian el costo de las
              motos.
            </CardDescription>
            <CardAction>
              <Link href={`/gastos?mes=${inicioMes.slice(0, 7)}&estado=realizado`} className="text-sm text-muted-foreground hover:underline">
                Ver gastos del mes
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <dl className="grid max-w-md gap-2 text-sm" aria-label="Utilidad neta del mes">
              <div className="flex justify-between gap-4">
                <dt>Ventas ({utilidad.unidades} unidad(es))</dt>
                <dd className="tabular-nums" data-testid="utilidad-ventas">
                  {formatPEN(utilidad.ventas)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>− Costo de lo vendido</dt>
                <dd className="tabular-nums" data-testid="utilidad-costo">
                  {formatPEN(utilidad.costo)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>− Gastos realizados ({utilidad.cantidadGastos})</dt>
                <dd className="tabular-nums" data-testid="utilidad-gastos">
                  {formatPEN(utilidad.gastos)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
                <dt>= Utilidad neta</dt>
                <dd className={cn('tabular-nums', utilidad.neta.startsWith('-') && 'text-destructive')} data-testid="utilidad-neta">
                  {formatPEN(utilidad.neta)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Unidades por estado</CardTitle>
            <CardDescription>Todo el inventario serializado. Toca un estado para ver sus unidades.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3" aria-label="Unidades por estado">
              {ESTADOS.map((e) => {
                const n = porEstado.get(e) ?? 0;
                return (
                  <li key={e}>
                    <Link
                      href={`/inventario?estado=${e}`}
                      className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 rounded-sm text-sm hover:bg-accent/50"
                      title={`${ESTADO_UNIDAD[e]}: ${n} unidad(es)`}
                    >
                      <span>{ESTADO_UNIDAD[e]}</span>
                      <span className="h-3 rounded-r bg-muted" aria-hidden>
                        <span className="block h-3 rounded-r bg-primary" style={{ width: `${anchoRelativo(n, maximo)}%` }} />
                      </span>
                      <span className="text-right font-medium tabular-nums" data-testid={`estado-${e}`}>
                        {n}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {esAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Alertas de conciliación</CardTitle>
              <CardDescription>Packing list vs DAM vs seriales registrados.</CardDescription>
            </CardHeader>
            <CardContent>
              {alertas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin diferencias en los lotes.</p>
              ) : (
                <ul className="grid gap-2 text-sm" aria-label="Alertas de conciliación">
                  {alertas.slice(0, 6).map((a) => (
                    <li key={`${a.batch_id}-${a.codigo_modelo}`} className="flex gap-2">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Alerta" />
                      <span>
                        <Link href={`/lotes/${a.batch_id}/auditoria`} className="font-medium hover:underline">
                          {a.codigo_embarque} · {a.codigo_modelo}
                        </Link>
                        : {alertasConciliacion(a).join('; ')}
                      </span>
                    </li>
                  ))}
                  {alertas.length > 6 && (
                    <li>
                      <Link href="/auditoria?estado=alertas" className="text-muted-foreground hover:underline">
                        Ver las {alertas.length} alertas
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
