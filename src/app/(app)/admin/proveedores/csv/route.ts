import type { NextRequest } from 'next/server';
import { exigirRol } from '@/lib/auth';
import { hoyLima } from '@/lib/format';
import { aCsv, leerParams, respuestaCsv } from '@/lib/tabla';
import { COLUMNAS_CSV, consultarProveedores } from '../datos';

export async function GET(request: NextRequest) {
  await exigirRol('admin');
  const params = leerParams(Object.fromEntries(request.nextUrl.searchParams));
  const { filas } = await consultarProveedores(params, { todas: true });
  return respuestaCsv(aCsv(filas, COLUMNAS_CSV), `proveedores-${hoyLima()}.csv`);
}
