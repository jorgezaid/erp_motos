import type { NextRequest } from 'next/server';
import { exigirRol } from '@/lib/auth';
import { COLUMNAS_CSV_STOCK, consultarStock } from '@/lib/consultas/stock';
import { aCsv, leerParams, respuestaCsv } from '@/lib/tabla';
import { obtenerLote } from '../../datos';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await exigirRol('admin');
  const { id } = await params;
  const lote = await obtenerLote(id);
  const filtros = leerParams(Object.fromEntries(request.nextUrl.searchParams));
  const { filas } = await consultarStock({ ...filtros, batchId: lote.id }, { todas: true });
  return respuestaCsv(aCsv(filas, COLUMNAS_CSV_STOCK), `unidades-${lote.codigo_embarque}.csv`);
}
