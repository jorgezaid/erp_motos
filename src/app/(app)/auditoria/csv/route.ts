import type { NextRequest } from 'next/server';
import { exigirRol } from '@/lib/auth';
import { formatFechaHora, hoyLima } from '@/lib/format';
import { margenPorModelo, margenPorVenta } from '@/lib/margenes';
import { aCsv, respuestaCsv } from '@/lib/tabla';
import { consultarConciliacion, consultarMargenes, leerFiltrosAuditoria } from '../datos';

/** CSV de /auditoria (solo admin): conciliación o margen real por venta o por modelo. */
export async function GET(request: NextRequest) {
  await exigirRol('admin');
  const f = leerFiltrosAuditoria(Object.fromEntries(request.nextUrl.searchParams));
  const fecha = hoyLima();

  if (f.vista === 'conciliacion') {
    const filas = await consultarConciliacion(f);
    return respuestaCsv(
      aCsv(filas, [
        { encabezado: 'Lote', valor: (c) => c.codigo_embarque },
        { encabezado: 'Modelo', valor: (c) => c.codigo_modelo },
        { encabezado: 'Packing list', valor: (c) => c.cantidad_packing_list },
        { encabezado: 'DAM', valor: (c) => c.cantidad_dam },
        { encabezado: 'Registradas', valor: (c) => c.unidades_registradas },
        { encabezado: 'Baterías completas', valor: (c) => c.unidades_baterias_completas },
        { encabezado: 'Inspección aprobada', valor: (c) => c.unidades_inspeccion_aprobada },
        { encabezado: 'Alertas', valor: (c) => c.alertas.join(' | ') },
      ]),
      `conciliacion-${fecha}.csv`,
    );
  }

  const filas = await consultarMargenes(f);
  const comunes = [
    { encabezado: 'Unidades', valor: (a: { unidades: number }) => a.unidades },
    { encabezado: 'Venta (S/)', valor: (a: { venta: string }) => a.venta },
    { encabezado: 'Costo (S/)', valor: (a: { costo: string }) => a.costo },
    { encabezado: 'Utilidad (S/)', valor: (a: { utilidad: string }) => a.utilidad },
    { encabezado: 'Margen real', valor: (a: { margen: string | null }) => a.margen },
  ];
  if (f.vista === 'ventas') {
    return respuestaCsv(
      aCsv(margenPorVenta(filas), [
        { encabezado: 'Venta', valor: (v) => v.numero },
        { encabezado: 'Fecha', valor: (v) => formatFechaHora(v.confirmada_at) },
        { encabezado: 'Cliente', valor: (v) => v.cliente },
        { encabezado: 'Escala', valor: (v) => v.tipo_venta },
        ...comunes,
      ]),
      `margen-por-venta-${fecha}.csv`,
    );
  }
  return respuestaCsv(
    aCsv(margenPorModelo(filas), [{ encabezado: 'Modelo', valor: (m) => m.codigo_modelo }, ...comunes]),
    `margen-por-modelo-${fecha}.csv`,
  );
}
