import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { exigirRol } from '@/lib/auth';
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
  const [{ data: pendientes, error }, { data: ubicaciones }] = await Promise.all([
    supabase.rpc('pendientes_de_registro'),
    supabase.from('locations').select('id, nombre').eq('activo', true).order('nombre'),
  ]);
  if (error) throw new Error(error.message);

  const opciones: Pendiente[] = pendientes
    .filter((p) => p.registradas < p.declaradas)
    .map((p) => ({ ...p, clave: `${p.batch_id}:${p.model_id}` }));

  return (
    <>
      <Encabezado
        titulo="Registro de unidades"
        descripcion="Registra VIN y motor de las unidades que llegaron, hasta lo declarado en el packing list (RN-04)."
      />
      <RegistroMasivo pendientes={opciones} ubicaciones={ubicaciones ?? []} />
    </>
  );
}
