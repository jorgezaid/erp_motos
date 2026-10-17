import 'server-only';
import type { DatosModelo } from '@/lib/modelos';
import { createClient } from '@/lib/supabase/server';

/**
 * Datos de identidad de todos los modelos (sin EXW ni CBM), por código, para cruzarlos con
 * `v_stock` (que no trae el nombre comercial). Staff lee `vehicle_models` (RLS).
 */
export async function leerIdentidadModelos(): Promise<Map<string, DatosModelo>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicle_models')
    .select('codigo_modelo, nombre_comercial, categoria, voltaje_sistema, cantidad_baterias_12v, potencia_motor_watts')
    .order('codigo_modelo');
  if (error) throw new Error(error.message);
  return new Map(data.map((m) => [m.codigo_modelo, m]));
}

/** Identidad de una fila de `v_stock`: la del catálogo, o lo que trae la fila si el modelo no está. */
export function modeloDeFila(
  f: Pick<DatosModelo, 'codigo_modelo' | 'categoria' | 'voltaje_sistema' | 'cantidad_baterias_12v' | 'potencia_motor_watts'>,
  modelos: ReadonlyMap<string, DatosModelo>,
): DatosModelo {
  const m = f.codigo_modelo ? modelos.get(f.codigo_modelo) : undefined;
  return (
    m ?? {
      codigo_modelo: f.codigo_modelo,
      categoria: f.categoria,
      voltaje_sistema: f.voltaje_sistema,
      cantidad_baterias_12v: f.cantidad_baterias_12v,
      potencia_motor_watts: f.potencia_motor_watts,
    }
  );
}
