import { BatteryFull, ClipboardCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { EstadoUnidad } from '@/components/estado-badge';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { Paginacion } from '@/components/tabla/paginacion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { exigirRol } from '@/lib/auth';
import { consultarStock, textoInspeccion } from '@/lib/consultas/stock';
import { ESTADO_UNIDAD } from '@/lib/etiquetas';
import { leerParams } from '@/lib/tabla';
import { cn } from '@/lib/utils';
import { BotonIniciarEnsamble } from './boton-ensamble';

export const metadata: Metadata = { title: 'Taller · ERP Vehículos Eléctricos' };

const ESTADOS_TALLER = ['en_caja', 'en_ensamble'] as const;

type SP = Record<string, string | string[] | undefined>;

/** /taller (SPEC M4): cola de unidades en caja y en ensamble. Diseño móvil primero. */
export default async function PaginaTaller({ searchParams }: { searchParams: Promise<SP> }) {
  await exigirRol('admin', 'tecnico');
  const sp = await searchParams;
  const params = leerParams(sp);
  const { filas, total } = await consultarStock({ ...params, estados: [...ESTADOS_TALLER] });

  return (
    <>
      <Encabezado titulo="Taller" descripcion="Unidades por armar e inspeccionar antes de pasar a tienda (RN-10)." />
      <BarraFiltros
        placeholder="Escanea o busca el VIN"
        estados={ESTADOS_TALLER.map((e) => ({ valor: e, etiqueta: ESTADO_UNIDAD[e] }))}
        csvHref="/taller/csv"
      />
      {filas.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">No hay unidades en la cola del taller.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Cola del taller">
          {filas.map((u) => {
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
                          {u.codigo_modelo} · {u.voltaje_sistema}V · {u.color_primario ?? 'sin color'}
                        </p>
                      </div>
                      {u.estado && <EstadoUnidad estado={u.estado} />}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className={cn('inline-flex items-center gap-1', baterias === esperadas && 'text-emerald-700 dark:text-emerald-400')}>
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
      )}
      <Paginacion pagina={params.pagina} total={total} searchParams={sp} />
    </>
  );
}
