import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { exigirRol } from '@/lib/auth';
import { leerIdentidadModelos } from '@/lib/consultas/modelos';
import { createClient } from '@/lib/supabase/server';
import { RegistroMasivo, type Pendiente } from './registro-masivo';

export const metadata: Metadata = { title: 'Registro de unidades · ERP Vehículos Eléctricos' };

/**
 * /inventario/registro (SPEC M4). El técnico no ve lotes ni costos: los pendientes salen de la
 * RPC `pendientes_de_registro()`, que solo devuelve códigos y cantidades.
 */
export default async function PaginaRegistro() {
  await exigirRol('admin', 'tecnico');
  const supabase = await createClient();
  const [{ data: pendientes, error }, { data: ubicaciones }, modelos] = await Promise.all([
    supabase.rpc('pendientes_de_registro'),
    supabase.from('locations').select('id, nombre').eq('activo', true).order('nombre'),
    leerIdentidadModelos(),
  ]);
  if (error) throw new Error(error.message);

  const opciones: Pendiente[] = pendientes
    .filter((p) => p.registradas < p.declaradas)
    .map((p) => ({
      ...p,
      clave: `${p.batch_id}:${p.model_id}`,
      modelo: modelos.get(p.codigo_modelo) ?? { codigo_modelo: p.codigo_modelo, categoria: null, voltaje_sistema: null },
    }));

  return (
    <>
      {/* Fuera del menú lateral (D40): se entra desde /inventario */}
      <p className="text-sm text-muted-foreground">
        <Link href="/inventario" className="hover:underline">
          Inventario
        </Link>{' '}
        / Registro de unidades
      </p>
      <Encabezado
        titulo="Registro de unidades"
        descripcion="Registra VIN y motor de las unidades que llegaron, hasta lo declarado en el packing list (RN-04)."
      />
      <RegistroMasivo pendientes={opciones} ubicaciones={ubicaciones ?? []} />
    </>
  );
}
