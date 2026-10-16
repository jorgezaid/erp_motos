import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { exigirRol } from '@/lib/auth';
import { formatPEN, hoyLima } from '@/lib/format';
import { agruparPorMesEstimado, etiquetaMes, sumarMontos } from '@/lib/gastos';
import { consultarPlanificados } from '../datos';
import { DialogoGasto } from '../dialogo-gasto';
import { TablaGastos } from '../tabla-gastos';

export const metadata: Metadata = { title: 'Gastos planificados · ERP Vehículos Eléctricos' };

/** Gastos planificados agrupados por mes estimado, con el total de cada mes (SPEC M9). */
export default async function PaginaPlanificados() {
  await exigirRol('admin');
  const hoy = hoyLima();
  const mesActual = hoy.slice(0, 7);
  const planificados = await consultarPlanificados();
  const grupos = agruparPorMesEstimado(planificados);

  return (
    <>
      <Encabezado
        titulo="Gastos planificados"
        descripcion={`${planificados.length} gasto(s) por pagar · total ${formatPEN(sumarMontos(planificados))}`}
      >
        <Button variant="outline" asChild>
          <Link href="/gastos">Todos los gastos</Link>
        </Button>
        <DialogoGasto
          hoy={hoy}
          inicial={{
            estado: 'planificado',
            fecha: '',
            fecha_estimada: hoy,
            categoria: 'otros',
            descripcion: '',
            proveedor: '',
            monto_pen: '',
            metodo_pago: '',
          }}
          disparador={<Button>Nuevo gasto planificado</Button>}
        />
      </Encabezado>

      {grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay gastos planificados.</p>
      ) : (
        <div className="grid gap-6">
          {grupos.map((g) => (
            <Card key={g.mes} aria-labelledby={`mes-${g.mes}`}>
              <CardHeader>
                <CardTitle id={`mes-${g.mes}`}>{etiquetaMes(g.mes)}</CardTitle>
                <CardDescription>
                  {g.filas.length} gasto(s){g.mes < mesActual ? ' · ya pasó la fecha estimada' : ''}
                </CardDescription>
                <CardAction>
                  <p className="text-lg font-semibold tabular-nums" data-testid={`total-mes-${g.mes}`}>
                    {formatPEN(g.total)}
                  </p>
                </CardAction>
              </CardHeader>
              <CardContent>
                <TablaGastos filas={g.filas} hoy={hoy} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
