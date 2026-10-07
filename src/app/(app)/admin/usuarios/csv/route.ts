import type { NextRequest } from 'next/server';
import { exigirRol } from '@/lib/auth';
import { aCsv, leerParams, respuestaCsv } from '@/lib/tabla';
import { hoyLima } from '@/lib/format';
import { COLUMNAS_CSV, consultarUsuarios } from '../datos';

export async function GET(request: NextRequest) {
  await exigirRol('admin');
  const params = leerParams(Object.fromEntries(request.nextUrl.searchParams));
  const usuarios = await consultarUsuarios(params);
  return respuestaCsv(aCsv(usuarios, COLUMNAS_CSV), `usuarios-${hoyLima()}.csv`);
}
