import 'server-only';
import type { DatosModelo } from '@/lib/modelos';
import { createClient } from '@/lib/supabase/server';

/**
 * Datos de identidad de todos los modelos (sin EXW ni CBM), por código, para cruzarlos con
 * `v_stock` (que no trae el nombre comercial). Staff lee `vehicle_models` (RLS).
 */
export async function leerIdentidadModelos(): Promise<Map<string, DatosModelo & { activo: boolean }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicle_models')
    .select('codigo_modelo, nombre_comercial, categoria, voltaje_sistema, cantidad_baterias_12v, potencia_motor_watts, activo')
    .order('codigo_modelo');
  if (error) throw new Error(error.message);
  return new Map(data.map((m) => [m.codigo_modelo, m]));
}
