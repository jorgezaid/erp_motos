import type { NextRequest } from 'next/server';
import { exigirRol } from '@/lib/auth';
import { hoyLima } from '@/lib/format';
import { aCsv, leerParams, respuestaCsv } from '@/lib/tabla';
import { COLUMNAS_CSV, consultarModelos } from '../datos';

export async function GET(request: NextRequest) {
  await exigirRol('admin');
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const { filas } = await consultarModelos({ ...leerParams(sp), categoria: sp.categoria }, { todas: true });
  return respuestaCsv(aCsv(filas, COLUMNAS_CSV), `modelos-${hoyLima()}.csv`);
}
