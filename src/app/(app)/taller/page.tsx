import { BatteryFull, ClipboardCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { EstadoUnidad } from '@/components/estado-badge';
import { IdentidadModelo } from '@/components/identidad-modelo';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Paginacion } from '@/components/tabla/paginacion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { exigirRol } from '@/lib/auth';
import { leerIdentidadModelos } from '@/lib/consultas/modelos';
import { consultarStock, textoInspeccion } from '@/lib/consultas/stock';
import { CATEGORIA, ESTADO_UNIDAD, opciones } from '@/lib/etiquetas';
import { agruparPorModelo, contarPorModelo, textoConteoTaller } from '@/lib/modelos';
import { createClient } from '@/lib/supabase/server';
import { leerParams, MAX_FILAS_CSV } from '@/lib/tabla';
import { cn } from '@/lib/utils';
import { BotonIniciarEnsamble } from './boton-ensamble';

export const metadata: Metadata = { title: 'Taller · ERP Vehículos Eléctricos' };

const ESTADOS_TALLER = ['en_caja', 'en_ensamble'] as const;

type SP = Record<string, string | string[] | undefined>;

/**
 * /taller (SPEC M4): cola de unidades en caja y en ensamble, agrupada por código de modelo con
 * su identidad (categoría, voltaje y baterías) y los totales del modelo en toda la cola.
 * Filtros rápidos por modelo y categoría. Diseño móvil primero.
 */
export default async function PaginaTaller({ searchParams }: { searchParams: Promise<SP> }) {
  await exigirRol('admin', 'tecnico');
  const sp = await searchParams;
  const params = leerParams(sp);
  const modelo = typeof sp.modelo === 'string' ? sp.modelo : '';
  const categoria = typeof sp.categoria === 'string' ? sp.categoria : '';
  const supabase = await createClient();

  const [{ filas, total }, modelos, cola] = await Promise.all([
    consultarStock({ ...params, modelo, categoria, estados: [...ESTADOS_TALLER] }),
    leerIdentidadModelos(),
    // Totales por modelo de toda la cola (no solo de la página ni de la búsqueda)
    supabase.from('v_stock').select('codigo_modelo, estado').in('estado', [...ESTADOS_TALLER]).limit(MAX_FILAS_CSV),
  ]);
  const conteos = contarPorModelo(cola.data ?? []);
  const grupos = agruparPorModelo(filas);
  const opcionesModelo = [...conteos.keys()]
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
    .map((c) => ({ valor: c, etiqueta: modelos.get(c)?.nombre_comercial ? `${c} · ${modelos.get(c)?.nombre_comercial}` : c }));

  return (
    <>
      <Encabezado titulo="Taller" descripcion="Unidades por armar e inspeccionar antes de pasar a tienda (RN-10)." />
      <BarraFiltros
        placeholder="Escanea o busca el VIN"
        estados={ESTADOS_TALLER.map((e) => ({ valor: e, etiqueta: ESTADO_UNIDAD[e] }))}
        extras={[
          { param: 'modelo', etiqueta: 'Modelo', opciones: opcionesModelo },
          { param: 'categoria', etiqueta: 'Categoría', opciones: opciones(CATEGORIA) },
        ]}
        csvHref="/taller/csv"
      />
      {filas.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">No hay unidades en la cola del taller.</p>
      ) : (
        <div className="grid gap-6" role="region" aria-label="Cola del taller">
          {grupos.map((g) => {
            const m = modelos.get(g.codigo);
            const conteo = textoConteoTaller(conteos.get(g.codigo));
            const titulo = [g.codigo, m?.nombre_comercial, conteo].filter(Boolean).join(' · ');
            return (
              <section key={g.codigo} aria-label={titulo} className="grid gap-3">
                <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b pb-2">
                  <IdentidadModelo
                    modelo={m ?? { codigo_modelo: g.codigo, categoria: g.filas[0]?.categoria ?? null, voltaje_sistema: g.filas[0]?.voltaje_sistema ?? null }}
                  />
                  <p className="text-sm font-medium" data-testid={`conteo-${g.codigo}`}>
                    {conteo}
                  </p>
                </header>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={`Unidades ${g.codigo}`}>
                  {g.filas.map((u) => {
                    const baterias = u.baterias_registradas ?? 0;
                    const esperadas = u.cantidad_baterias_12v ?? 0;
                    return (
                      <li key={u.vehicle_id}>
                        <Card className="h-full py-4">
                          <CardContent className="grid gap-3 px-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-mono font-semibold">{u.vin_chasis}</p>
                                <p className="text-sm text-muted-foreground">
                                  {u.codigo_modelo} · {[u.color_primario, u.color_secundario].filter(Boolean).join(' / ') || 'sin color'}
                                </p>
                              </div>
                              {u.estado && <EstadoUnidad estado={u.estado} />}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                              <span
                                className={cn('inline-flex items-center gap-1', baterias === esperadas && 'text-emerald-700 dark:text-emerald-400')}
                              >
                                <BatteryFull className="size-4" aria-hidden /> Baterías {baterias}/{esperadas}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <ClipboardCheck className="size-4" aria-hidden /> {textoInspeccion(u.ultima_inspeccion_aprobada)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {u.estado === 'en_caja' ? (
                                <BotonIniciarEnsamble vehicleId={u.vehicle_id ?? ''} vin={u.vin_chasis ?? ''} />
                              ) : (
                                <Button size="sm" asChild>
                                  <Link href={`/taller/${u.vehicle_id}`} aria-label={`Abrir ${u.vin_chasis}`}>
                                    Baterías e inspección
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <Paginacion pagina={params.pagina} total={total} searchParams={sp} />
    </>
  );
}
