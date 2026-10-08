import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exigirRol } from '@/lib/auth';
import { TIPO_VENTA_CORTO } from '@/lib/etiquetas';
import { formatFechaHora, formatPEN, formatPorcentaje } from '@/lib/format';
import { margenPorModelo, margenPorVenta, totalMargen, type Agregado } from '@/lib/margenes';
import { cn } from '@/lib/utils';
import { consultarConciliacion, consultarMargenes, leerFiltrosAuditoria, type Vista } from './datos';
import { FiltroFechas } from './filtro-fechas';

export const metadata: Metadata = { title: 'Auditoría · ERP Vehículos Eléctricos' };

type SP = Record<string, string | string[] | undefined>;

const PESTANAS: { vista: Vista; etiqueta: string }[] = [
  { vista: 'conciliacion', etiqueta: 'Conciliación de lotes' },
  { vista: 'ventas', etiqueta: 'Margen por venta' },
  { vista: 'modelos', etiqueta: 'Margen por modelo' },
];

function Totales({ a }: { a: Agregado }) {
  return (
    <>
      <TableCell className="text-right">{a.unidades}</TableCell>
      <TableCell className="text-right">{formatPEN(a.venta)}</TableCell>
      <TableCell className="text-right">{formatPEN(a.costo)}</TableCell>
      <TableCell className="text-right">{formatPEN(a.utilidad)}</TableCell>
      <TableCell className="text-right">{formatPorcentaje(a.margen)}</TableCell>
    </>
  );
}

/** /auditoria (SPEC M8, solo admin): conciliación packing/DAM/seriales y margen real por venta y por modelo. */
export default async function PaginaAuditoria({ searchParams }: { searchParams: Promise<SP> }) {
  await exigirRol('admin');
  const sp = await searchParams;
  const f = leerFiltrosAuditoria(sp);
  const csv = `/auditoria/csv?vista=${f.vista}`;

  let contenido: React.ReactNode;
  if (f.vista === 'conciliacion') {
    const filas = await consultarConciliacion(f);
    contenido = (
      <>
        <BarraFiltros
          placeholder="Buscar por lote o modelo"
          estados={[
            { valor: 'alertas', etiqueta: 'Con alertas' },
            { valor: 'ok', etiqueta: 'Sin diferencias' },
          ]}
          csvHref={csv}
        />
        <div className="overflow-x-auto rounded-md border">
          <Table aria-label="Conciliación de lotes">
            <TableHeader>
              <TableRow>
                <TableHead>Lote</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead className="text-right">Packing list</TableHead>
                <TableHead className="text-right">DAM</TableHead>
                <TableHead className="text-right">Registradas</TableHead>
                <TableHead className="text-right">Baterías completas</TableHead>
                <TableHead className="text-right">Inspección aprobada</TableHead>
                <TableHead>Alertas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                    Sin resultados.
                  </TableCell>
                </TableRow>
              )}
              {filas.map((c) => (
                <TableRow
                  key={`${c.batch_id}-${c.codigo_modelo}`}
                  className={cn(c.alertas.length > 0 && 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100')}
                  data-alerta={c.alertas.length > 0 || undefined}
                >
                  <TableCell>
                    <Link href={`/lotes/${c.batch_id}/auditoria`} className="font-medium hover:underline">
                      {c.codigo_embarque}
                    </Link>
                  </TableCell>
                  <TableCell>{c.codigo_modelo}</TableCell>
                  <TableCell className="text-right">{c.cantidad_packing_list}</TableCell>
                  <TableCell className="text-right">{c.cantidad_dam ?? '—'}</TableCell>
                  <TableCell className="text-right">{c.unidades_registradas}</TableCell>
                  <TableCell className="text-right">{c.unidades_baterias_completas}</TableCell>
                  <TableCell className="text-right">{c.unidades_inspeccion_aprobada}</TableCell>
                  <TableCell className="whitespace-normal">{c.alertas.join(' · ') || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  } else {
    const filas = await consultarMargenes(f);
    const total = totalMargen(filas);
    const encabezados = (
      <>
        <TableHead className="text-right">Unidades</TableHead>
        <TableHead className="text-right">Venta</TableHead>
        <TableHead className="text-right">Costo</TableHead>
        <TableHead className="text-right">Utilidad</TableHead>
        <TableHead className="text-right">Margen real</TableHead>
      </>
    );
    contenido = (
      <>
        <BarraFiltros placeholder={f.vista === 'ventas' ? 'Buscar por cliente o modelo' : 'Buscar por modelo'} csvHref={csv} />
        <FiltroFechas />
        <div className="overflow-x-auto rounded-md border">
          {f.vista === 'ventas' ? (
            <Table aria-label="Margen por venta">
              <TableHeader>
                <TableRow>
                  <TableHead>Venta</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Escala</TableHead>
                  {encabezados}
                </TableRow>
              </TableHeader>
              <TableBody>
                {margenPorVenta(filas).map((v) => (
                  <TableRow key={v.order_id}>
                    <TableCell>
                      <Link href={`/ventas/${v.order_id}`} className="font-medium hover:underline">
                        #{v.numero}
                      </Link>
                    </TableCell>
                    <TableCell>{formatFechaHora(v.confirmada_at)}</TableCell>
                    <TableCell>{v.cliente}</TableCell>
                    <TableCell>{v.tipo_venta ? TIPO_VENTA_CORTO[v.tipo_venta as keyof typeof TIPO_VENTA_CORTO] : '—'}</TableCell>
                    <Totales a={v} />
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Total</TableCell>
                  <Totales a={total} />
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            <Table aria-label="Margen por modelo">
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
                  {encabezados}
                </TableRow>
              </TableHeader>
              <TableBody>
                {margenPorModelo(filas).map((m) => (
                  <TableRow key={m.codigo_modelo}>
                    <TableCell className="font-medium">{m.codigo_modelo}</TableCell>
                    <Totales a={m} />
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <Totales a={total} />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Encabezado
        titulo="Auditoría"
        descripcion="Diferencias entre packing list, DAM y seriales, y margen real de las ventas confirmadas."
      />
      <nav aria-label="Vistas de auditoría" className="mb-6 flex gap-1 overflow-x-auto border-b">
        {PESTANAS.map((p) => (
          <Link
            key={p.vista}
            href={`/auditoria?vista=${p.vista}`}
            aria-current={f.vista === p.vista ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap',
              f.vista === p.vista ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {p.etiqueta}
          </Link>
        ))}
      </nav>
      {contenido}
    </>
  );
}
