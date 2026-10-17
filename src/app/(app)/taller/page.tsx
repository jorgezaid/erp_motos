import { BatteryFull, ClipboardCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { EstadoUnidad } from '@/components/estado-badge';
import { EtiquetaSinSerial } from '@/components/etiqueta-sin-serial';
import { IdentidadModelo } from '@/components/identidad-modelo';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Paginacion } from '@/components/tabla/paginacion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { exigirRol } from '@/lib/auth';
import { leerIdentidadModelos, modeloDeFila } from '@/lib/consultas/modelos';
import { contarMotosSinSerialReal } from '@/lib/consultas/provisionales';
import { consultarStock, FILTRO_SIN_SERIAL_REAL, OPCION_FILTRO_BATERIAS, textoInspeccion } from '@/lib/consultas/stock';
import { CATEGORIA, ESTADO_UNIDAD, opciones } from '@/lib/etiquetas';
import { agruparPorModelo, contarPorModelo, textoConteoTaller } from '@/lib/modelos';
import { createClient } from '@/lib/supabase/server';
import { leerParams, MAX_FILAS_CSV } from '@/lib/tabla';
import { posicionesLibres } from '@/lib/taller';
import { cn } from '@/lib/utils';
import { BotonIniciarEnsamble } from './boton-ensamble';
import { BotonListoRapido, CasillaMoto, ListoRapidoProvider, type MotoRapida } from './listo-rapido';

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
  const filtroBaterias = typeof sp.baterias === 'string' ? sp.baterias : '';
  const supabase = await createClient();

  const [{ filas, total }, modelos, cola] = await Promise.all([
    consultarStock({ ...params, modelo, categoria, baterias: filtroBaterias, estados: [...ESTADOS_TALLER] }),
    leerIdentidadModelos(),
    // Totales por modelo de toda la cola (no solo de la página ni de la búsqueda)
    supabase.from('v_stock').select('codigo_modelo, estado').in('estado', [...ESTADOS_TALLER]).limit(MAX_FILAS_CSV),
  ]);
  // D37: posiciones ya ocupadas (para las casillas de «Listo rápido») y ubicaciones en tienda
  const ids = filas.flatMap((f) => f.vehicle_id ?? []);
  const [{ data: baterias }, { data: ubicaciones }, sinSerialReal] = await Promise.all([
    supabase.from('vehicle_batteries').select('vehicle_id, posicion').in('vehicle_id', ids),
    supabase.from('locations').select('id, nombre').eq('activo', true).in('tipo', ['showroom', 'almacen']).order('nombre'),
    contarMotosSinSerialReal(),
  ]);
  const ocupadas = new Map<string, (number | null)[]>();
  for (const b of baterias ?? []) ocupadas.set(b.vehicle_id, [...(ocupadas.get(b.vehicle_id) ?? []), b.posicion]);
  const motos: MotoRapida[] = filas.flatMap((f) =>
    f.vehicle_id
      ? [
          {
            vehicleId: f.vehicle_id,
            vin: f.vin_chasis ?? '',
            codigo: f.codigo_modelo ?? '',
            libres: posicionesLibres(f.cantidad_baterias_12v ?? 0, ocupadas.get(f.vehicle_id) ?? []),
          },
        ]
      : [],
  );

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
          OPCION_FILTRO_BATERIAS,
        ]}
        csvHref="/taller/csv"
      />
      {sinSerialReal > 0 && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <EtiquetaSinSerial cantidad={sinSerialReal} />
          {sinSerialReal} {sinSerialReal === 1 ? 'moto tiene' : 'motos tienen'} seriales provisionales.
          <Link href={`/inventario?baterias=${FILTRO_SIN_SERIAL_REAL}`} className="font-medium underline">
            Ver y reemplazar
          </Link>
        </p>
      )}
      {filas.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">No hay unidades en la cola del taller.</p>
      ) : (
        <ListoRapidoProvider motos={motos} ubicaciones={ubicaciones ?? []}>
        <div className="grid gap-6" role="region" aria-label="Cola del taller">
          {grupos.map((g) => {
            const [primera] = g.filas;
            if (!primera) return null;
            const m = modelos.get(g.codigo);
            const conteo = textoConteoTaller(conteos.get(g.codigo));
            const titulo = [g.codigo, m?.nombre_comercial, conteo].filter(Boolean).join(' · ');
            return (
              <section key={g.codigo} aria-label={titulo} className="grid gap-3">
                <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b pb-2">
                  <IdentidadModelo modelo={modeloDeFila(primera, modelos)} />
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
                              <div className="pt-1">
                                <CasillaMoto vehicleId={u.vehicle_id ?? ''} vin={u.vin_chasis ?? ''} />
                              </div>
                              <div className="min-w-0 flex-1">
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
                              <EtiquetaSinSerial cantidad={u.baterias_provisionales} />
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
                              <BotonListoRapido vehicleId={u.vehicle_id ?? ''} vin={u.vin_chasis ?? ''} />
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
        </ListoRapidoProvider>
      )}
      <Paginacion pagina={params.pagina} total={total} searchParams={sp} />
    </>
  );
}
