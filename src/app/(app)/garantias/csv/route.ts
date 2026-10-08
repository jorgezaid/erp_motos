import type { NextRequest } from 'next/server';
import { exigirRol } from '@/lib/auth';
import { hoyLima } from '@/lib/format';
import { aCsv, leerParams, respuestaCsv } from '@/lib/tabla';
import { COLUMNAS_CSV_GARANTIAS, COLUMNAS_CSV_RECLAMOS, consultarGarantias, consultarReclamos } from '../datos';

export async function GET(request: NextRequest) {
  await exigirRol();
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  if (sp.tipo === 'reclamos') {
    const filas = await consultarReclamos(sp.reclamo ?? '', { todas: true });
    return respuestaCsv(aCsv(filas, COLUMNAS_CSV_RECLAMOS), `reclamos-${hoyLima()}.csv`);
  }
  const { filas } = await consultarGarantias(leerParams(sp), { todas: true });
  return respuestaCsv(aCsv(filas, COLUMNAS_CSV_GARANTIAS), `garantias-${hoyLima()}.csv`);
}
