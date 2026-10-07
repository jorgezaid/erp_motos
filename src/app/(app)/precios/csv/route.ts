import type { NextRequest } from 'next/server';
import { exigirRol } from '@/lib/auth';
import { hoyLima } from '@/lib/format';
import { aCsv, leerParams, respuestaCsv } from '@/lib/tabla';
import { preciosAdmin, preciosVendedor } from '../datos';

export async function GET(request: NextRequest) {
  const sesion = await exigirRol('admin', 'vendedor');
  const { q } = leerParams(Object.fromEntries(request.nextUrl.searchParams));
  const nombre = `precios-${hoyLima()}.csv`;

  if (sesion.rol !== 'admin') {
    const filas = await preciosVendedor(q);
    return respuestaCsv(
      aCsv(filas, [
        { encabezado: 'Modelo', valor: (f) => f.codigo_modelo },
        { encabezado: 'Nombre', valor: (f) => f.nombre },
        { encabezado: 'Disponibles', valor: (f) => f.disponibles },
        { encabezado: 'Precio x1', valor: (f) => f.x1 },
        { encabezado: 'Precio x3', valor: (f) => f.x3 },
        { encabezado: 'Precio x6', valor: (f) => f.x6 },
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
