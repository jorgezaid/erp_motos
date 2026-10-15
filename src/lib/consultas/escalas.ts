import 'server-only';
import { ordenarEscalas, type Escala } from '@/lib/escalas';
import { createClient } from '@/lib/supabase/server';

/** Escalas de venta (tipo, mínimo y si está activa) en el orden x1, x3, x6. Sin márgenes. */
export async function leerEscalas(): Promise<Escala[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('price_margins').select('tipo_venta, cantidad_minima, activo');
  if (error) throw new Error(error.message);
  return ordenarEscalas(data);
}
