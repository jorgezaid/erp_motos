import type { NextRequest } from 'next/server';
import { exigirRol } from '@/lib/auth';
import { ROLES_VENTA } from '@/lib/roles';
import { hoyLima } from '@/lib/format';
import { aCsv, leerParams, respuestaCsv } from '@/lib/tabla';
import { COLUMNAS_CSV, consultarVentas } from '../datos';

export async function GET(request: NextRequest) {
  const sesion = await exigirRol(...ROLES_VENTA);
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const { filas } = await consultarVentas(
    { ...leerParams(sp), tipo: sp.tipo, mios: sp.mios },
    { userId: sesion.userId, esAdmin: sesion.rol === 'admin' },
    { todas: true },
  );
  return respuestaCsv(aCsv(filas, COLUMNAS_CSV), `ventas-${hoyLima()}.csv`);
}
