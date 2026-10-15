import type { NextRequest } from 'next/server';
import { exigirRol } from '@/lib/auth';
import { leerEscalas } from '@/lib/consultas/escalas';
import { tiposActivos } from '@/lib/escalas';
import { hoyLima } from '@/lib/format';
import { aCsv, leerParams, respuestaCsv, type ColumnaCsv } from '@/lib/tabla';
import type { TipoVenta } from '@/lib/ventas';
import { preciosAdmin, preciosVendedor, type FilaPrecioVendedor } from '../datos';

export async function GET(request: NextRequest) {
  const sesion = await exigirRol('admin', 'vendedor');
  const { q } = leerParams(Object.fromEntries(request.nextUrl.searchParams));
  const nombre = `precios-${hoyLima()}.csv`;

  if (sesion.rol !== 'admin') {
    const [filas, escalas] = await Promise.all([preciosVendedor(q), leerEscalas()]);
    const precios: Record<TipoVenta, ColumnaCsv<FilaPrecioVendedor>> = {
      unidad_x1: { encabezado: 'Precio x1', valor: (f) => f.x1 },
      mayorista_x3: { encabezado: 'Precio x3', valor: (f) => f.x3 },
      distribuidor_x6: { encabezado: 'Precio x6', valor: (f) => f.x6 },
    };
    return respuestaCsv(
      aCsv(filas, [
        { encabezado: 'Modelo', valor: (f) => f.codigo_modelo },
        { encabezado: 'Nombre', valor: (f) => f.nombre },
        { encabezado: 'Disponibles', valor: (f) => f.disponibles },
        // Solo las escalas activas, como en la pantalla (D31)
        ...tiposActivos(escalas).map((t) => precios[t]),
      ]),
      nombre,
    );
  }

  const filas = await preciosAdmin(q);
  return respuestaCsv(
    aCsv(filas, [
      { encabezado: 'Modelo', valor: (f) => f.codigo_modelo },
      { encabezado: 'Lote', valor: (f) => f.codigo_embarque },
      { encabezado: 'Disponibles', valor: (f) => f.disponibles },
      { encabezado: 'Costo unitario', valor: (f) => f.costo },
      { encabezado: 'Precio x1', valor: (f) => f.precios.unidad_x1?.venta },
      { encabezado: 'Manual x1', valor: (f) => (f.precios.unidad_x1?.manual != null ? 'Sí' : 'No') },
      { encabezado: 'Precio x3', valor: (f) => f.precios.mayorista_x3?.venta },
      { encabezado: 'Manual x3', valor: (f) => (f.precios.mayorista_x3?.manual != null ? 'Sí' : 'No') },
      { encabezado: 'Precio x6', valor: (f) => f.precios.distribuidor_x6?.venta },
      { encabezado: 'Manual x6', valor: (f) => (f.precios.distribuidor_x6?.manual != null ? 'Sí' : 'No') },
    ]),
    nombre,
  );
}
