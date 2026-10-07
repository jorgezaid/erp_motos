import type { NextRequest } from 'next/server';
import { exigirRol } from '@/lib/auth';
import { hoyLima } from '@/lib/format';
import { aCsv, leerParams, respuestaCsv } from '@/lib/tabla';
import { COLUMNAS_CSV, consultarUbicaciones } from '../datos';

export async function GET(request: NextRequest) {
  await exigirRol('admin');
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const { filas } = await consultarUbicaciones({ ...leerParams(sp), tipo: sp.tipo }, { todas: true });
  return respuestaCsv(aCsv(filas, COLUMNAS_CSV), `ubicaciones-${hoyLima()}.csv`);
}
