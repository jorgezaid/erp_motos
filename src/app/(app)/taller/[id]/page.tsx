import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Encabezado } from '@/components/encabezado';
import { EstadoUnidad } from '@/components/estado-badge';
import { EtiquetaSinSerial } from '@/components/etiqueta-sin-serial';
import { IdentidadModelo } from '@/components/identidad-modelo';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { exigirRol } from '@/lib/auth';
import { formatFechaHora } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { esSerialProvisional, motivosObservada } from '@/lib/taller';
import { BotonIniciarEnsamble } from '../boton-ensamble';
import { SeccionBaterias } from './baterias';
import { FormularioInspeccion } from './inspeccion';
import { PasarATienda } from './pasar-tienda';

/** /taller/[id] (SPEC M4): baterías, inspección y "Pasar a tienda". Diseño móvil primero. */
export default async function UnidadTaller({ params }: { params: Promise<{ id: string }> }) {
  await exigirRol('admin', 'tecnico');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();

  const [{ data: u }, { data: baterias }, { data: inspecciones }, { data: ubicaciones }] = await Promise.all([
    supabase
      .from('vehicle_inventory')
      .select(
        'id, vin_chasis, nro_motor, estado, location_id, color_primario, color_secundario, vehicle_models(codigo_modelo, nombre_comercial, categoria, voltaje_sistema, cantidad_baterias_12v, potencia_motor_watts)',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase.from('vehicle_batteries').select('id, serial, posicion').eq('vehicle_id', id).order('posicion'),
    supabase
      .from('technical_inspections')
      .select('id, aprobada, baterias_contadas, baterias_esperadas, vin_verificado, motor_verificado, voltaje_medido, observaciones, created_at')
      .eq('vehicle_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('locations').select('id, nombre').eq('activo', true).in('tipo', ['showroom', 'almacen']).order('nombre'),
  ]);
  if (!u || !u.vehicle_models) notFound();

  const m = u.vehicle_models;
  const esperadas = m.cantidad_baterias_12v ?? m.voltaje_sistema / 12;
  const ultima = inspecciones?.[0] ?? null;
  const enTaller = u.estado === 'en_ensamble';

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <p className="text-sm text-muted-foreground">
        <Link href="/taller" className="hover:underline">
          Taller
        </Link>{' '}
        / {u.vin_chasis}
      </p>
      <Encabezado
        titulo={<span className="font-mono">{u.vin_chasis}</span>}
        descripcion={`Motor ${u.nro_motor} · ${[u.color_primario, u.color_secundario].filter(Boolean).join(' / ') || 'sin color'}`}
      >
        <EstadoUnidad estado={u.estado} />
      </Encabezado>

      {/* Identidad del modelo bien visible: qué moto es y cuántas baterías lleva */}
      <Card className="py-4">
        <CardContent className="px-4">
          <IdentidadModelo modelo={m} tamano="grande" />
        </CardContent>
      </Card>

      {u.estado === 'en_caja' && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">La unidad está en caja. Iníciala para armarla.</span>
            <BotonIniciarEnsamble vehicleId={u.id} vin={u.vin_chasis} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            1. Seriales de batería
            <EtiquetaSinSerial cantidad={(baterias ?? []).filter((b) => esSerialProvisional(b.serial)).length} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SeccionBaterias vehicleId={u.id} esperadas={esperadas} registradas={baterias ?? []} editable={enTaller} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            2. Inspección técnica
            {ultima &&
              (ultima.aprobada ? (
                <Badge className="border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">Aprobada</Badge>
              ) : (
                <Badge className="border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100">Observada</Badge>
              ))}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {ultima && (
            <div className="rounded-md border p-3 text-sm" data-testid="ultima-inspeccion">
              <p className="font-medium">
                Última: {ultima.aprobada ? 'aprobada' : 'observada'} · {formatFechaHora(ultima.created_at)}
              </p>
              {!ultima.aprobada && <p className="text-muted-foreground">{motivosObservada(ultima).join('; ')}</p>}
              {ultima.observaciones && <p className="text-muted-foreground">{ultima.observaciones}</p>}
            </div>
          )}
          {u.estado === 'en_ensamble' || u.estado === 'listo_en_tienda' ? (
            <FormularioInspeccion vehicleId={u.id} esperadas={esperadas} />
          ) : (
            <p className="text-sm text-muted-foreground">Solo se inspeccionan unidades en ensamble o en tienda.</p>
          )}
        </CardContent>
      </Card>

      {enTaller && (
        <Card>
          <CardHeader>
            <CardTitle>3. Pasar a tienda</CardTitle>
          </CardHeader>
          <CardContent>
            <PasarATienda
              vehicleId={u.id}
              vin={u.vin_chasis}
              estado={u.estado}
              baterias={baterias?.length ?? 0}
              esperadas={esperadas}
              ultimaInspeccionAprobada={ultima ? !!ultima.aprobada : null}
              ubicaciones={ubicaciones ?? []}
              ubicacionActual={u.location_id}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
