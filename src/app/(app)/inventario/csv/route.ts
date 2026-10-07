import type { NextRequest } from 'next/server';
import { exigirRol } from '@/lib/auth';
import { COLUMNAS_CSV_STOCK, consultarStock } from '@/lib/consultas/stock';
import { hoyLima } from '@/lib/format';
import { aCsv, leerParams, respuestaCsv, type ColumnaCsv } from '@/lib/tabla';
import { leerFiltrosInventario } from '../datos';

type Fila = Awaited<ReturnType<typeof consultarStock>>['filas'][number];

const PRECIOS: ColumnaCsv<Fila>[] = [
  { encabezado: 'Precio x1', valor: (s) => s.precio_x1 },
  { encabezado: 'Precio x3', valor: (s) => s.precio_x3 },
  { encabezado: 'Precio x6', valor: (s) => s.precio_x6 },
];

export async function GET(request: NextRequest) {
  const sesion = await exigirRol();
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const { filas } = await consultarStock({ ...leerParams(sp), ...leerFiltrosInventario(sp) }, { todas: true });
  const columnas = sesion.rol === 'tecnico' ? COLUMNAS_CSV_STOCK : [...COLUMNAS_CSV_STOCK, ...PRECIOS];
  return respuestaCsv(aCsv(filas, columnas), `inventario-${hoyLima()}.csv`);
}
