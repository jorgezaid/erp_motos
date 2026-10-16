import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Paginacion } from '@/components/tabla/paginacion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { exigirRol } from '@/lib/auth';
import { CATEGORIA_GASTO, opciones } from '@/lib/etiquetas';
import { formatPEN, hoyLima } from '@/lib/format';
import { etiquetaMes, leerMes, mesesDisponibles, TODOS_LOS_MESES, totalesGastos } from '@/lib/gastos';
import { leerParams } from '@/lib/tabla';
import { consultarFechas, consultarGastos, consultarMontos, ESTADOS_GASTO } from './datos';
import { DialogoGasto } from './dialogo-gasto';
import { TablaGastos } from './tabla-gastos';

export const metadata: Metadata = { title: 'Gastos · ERP Vehículos Eléctricos' };

type SP = Record<string, string | string[] | undefined>;

function Total({ etiqueta, valor, detalle, testId }: { etiqueta: string; valor: string; detalle?: string; testId: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="grid gap-1 px-4">
        <p className="text-sm text-muted-foreground">{etiqueta}</p>
        <p className="text-2xl font-semibold tabular-nums" data-testid={testId}>
          {valor}
        </p>
        {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
      </CardContent>
    </Card>
  );
}

/** Gastos del negocio (SPEC M9, solo admin). Nunca tocan el costo de las motos (RN-22). */
export default async function PaginaGastos({ searchParams }: { searchParams: Promise<SP> }) {
  await exigirRol('admin');
  const sp = await searchParams;
  const params = leerParams(sp);
  const hoy = hoyLima();
  const mesActual = hoy.slice(0, 7);
  const mes = leerMes(typeof sp.mes === 'string' ? sp.mes : undefined, mesActual);
  const categoria = typeof sp.categoria === 'string' ? sp.categoria : '';
  const filtros = { ...params, categoria, mes };

  const [{ filas, total }, montos, fechas] = await Promise.all([consultarGastos(filtros), consultarMontos(filtros), consultarFechas()]);
  const totales = totalesGastos(montos);
  const periodo = mes ? etiquetaMes(mes) : 'Todos los meses';
  const meses = [
    { valor: TODOS_LOS_MESES, etiqueta: 'Todos los meses' },
    ...mesesDisponibles(fechas, mesActual).map((m) => ({ valor: m, etiqueta: etiquetaMes(m) })),
  ];

  return (
    <>
      <Encabezado
        titulo="Gastos"
        descripcion="Gastos del negocio. No cambian el costo de las motos ni los precios: se restan de la utilidad del mes."
      >
        <Button variant="outline" asChild>
          <Link href="/gastos/planificados">Planificados</Link>
        </Button>
        <DialogoGasto hoy={hoy} disparador={<Button>Nuevo gasto</Button>} />
      </Encabezado>

      <BarraFiltros
        placeholder="Buscar por descripción o proveedor"
        estados={ESTADOS_GASTO}
        extras={[
          { param: 'mes', etiqueta: 'Mes', opciones: meses, predeterminado: mesActual },
          { param: 'categoria', etiqueta: 'Categoría', opciones: opciones(CATEGORIA_GASTO) },
        ]}
        csvHref="/gastos/csv"
      />

      <section aria-label={`Totales: ${periodo}`} className="mb-4 grid gap-4 sm:grid-cols-3">
        <Total etiqueta={`Realizado · ${periodo}`} valor={formatPEN(totales.realizado)} detalle="Se resta de la utilidad" testId="total-realizado" />
        <Total etiqueta={`Planificado · ${periodo}`} valor={formatPEN(totales.planificado)} detalle="Aún no pagado" testId="total-planificado" />
        <Total etiqueta={`Total · ${periodo}`} valor={formatPEN(totales.total)} detalle={`${totales.cantidad} gasto(s)`} testId="total-gastos" />
      </section>
      {totales.porCategoria.length > 0 && (
        <ul aria-label="Total por categoría" className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {totales.porCategoria.map((c) => (
            <li key={c.categoria}>
              {CATEGORIA_GASTO[c.categoria]}: <span className="font-medium text-foreground tabular-nums">{formatPEN(c.total)}</span>
            </li>
          ))}
        </ul>
      )}

      <TablaGastos filas={filas} hoy={hoy} />
      <Paginacion pagina={params.pagina} total={total} searchParams={sp} />
    </>
  );
}
