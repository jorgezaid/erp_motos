import type { NextRequest } from 'next/server';
import { exigirRol } from '@/lib/auth';
import { hoyLima } from '@/lib/format';
import { leerMes } from '@/lib/gastos';
import { aCsv, leerParams, respuestaCsv } from '@/lib/tabla';
import { COLUMNAS_CSV, consultarGastos } from '../datos';

export async function GET(request: NextRequest) {
  await exigirRol('admin');
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const mes = leerMes(sp.mes, hoyLima().slice(0, 7));
  const { filas } = await consultarGastos({ ...leerParams(sp), categoria: sp.categoria, mes }, { todas: true });
  return respuestaCsv(aCsv(filas, COLUMNAS_CSV), `gastos-${mes ?? 'todos'}-${hoyLima()}.csv`);
}
