import type { NextRequest } from 'next/server';
import { exigirRol } from '@/lib/auth';
import { COLUMNAS_CSV_STOCK, consultarStock } from '@/lib/consultas/stock';
import { hoyLima } from '@/lib/format';
import { aCsv, leerParams, respuestaCsv } from '@/lib/tabla';

export async function GET(request: NextRequest) {
  await exigirRol('admin', 'tecnico');
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const { filas } = await consultarStock(
    { ...leerParams(sp), modelo: sp.modelo, categoria: sp.categoria, baterias: sp.baterias, estados: ['en_caja', 'en_ensamble'] },
    { todas: true },
  );
  return respuestaCsv(aCsv(filas, COLUMNAS_CSV_STOCK), `taller-${hoyLima()}.csv`);
}
