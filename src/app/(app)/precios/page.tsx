import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { exigirRol } from '@/lib/auth';
import { aPorcentaje } from '@/lib/esquemas/precios';
import { leerParams } from '@/lib/tabla';
import { margenesActuales, preciosAdmin, preciosVendedor } from './datos';
import { FormularioMargenes } from './formulario-margenes';
import { TablaPreciosAdmin } from './tabla-admin';
import { TablaPreciosVendedor } from './tabla-vendedor';

export const metadata: Metadata = { title: 'Precios · ERP Vehículos Eléctricos' };

type SP = Record<string, string | string[] | undefined>;

/**
 * /precios (SPEC M5). Admin: costo, precios, utilidad, precio manual y márgenes.
 * Vendedor: modelo, stock y precios. Las ramas son excluyentes: para el vendedor no se
 * consulta ni se serializa ningún costo.
 */
export default async function PaginaPrecios({ searchParams }: { searchParams: Promise<SP> }) {
  const sesion = await exigirRol('admin', 'vendedor');
  const { q } = leerParams(await searchParams);

  if (sesion.rol !== 'admin') {
    const filas = await preciosVendedor(q);
    return (
      <>
        <Encabezado titulo="Precios" descripcion="Precios de venta por escala y unidades disponibles en tienda (incluyen IGV)." />
        <BarraFiltros placeholder="Buscar por modelo" csvHref="/precios/csv" />
        <TablaPreciosVendedor filas={filas} />
      </>
    );
  }

  const [filas, margenes] = await Promise.all([preciosAdmin(q), margenesActuales()]);
  const margen = (t: string) => aPorcentaje(margenes.find((m) => m.tipo_venta === t)?.margen_objetivo ?? 0);

  return (
    <>
      <Encabezado
        titulo="Precios"
        descripcion="Precio = costo unitario / (1 − margen). Los precios manuales se marcan y se conservan al recalcular."
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Márgenes globales</CardTitle>
          <CardDescription>
            Margen sobre el precio de venta. Al guardarlos se recalculan los precios sugeridos de todos los lotes
            liquidados (RN-09).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioMargenes
            inicial={{ unidad_x1: margen('unidad_x1'), mayorista_x3: margen('mayorista_x3'), distribuidor_x6: margen('distribuidor_x6') }}
          />
        </CardContent>
      </Card>
      <BarraFiltros placeholder="Buscar por modelo o lote" csvHref="/precios/csv" />
      <TablaPreciosAdmin filas={filas} />
    </>
  );
}
