import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { exigirRol } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { FormularioNuevaVenta } from './formulario-nueva';

export const metadata: Metadata = { title: 'Nueva venta · ERP Vehículos Eléctricos' };

/** /ventas/nueva (SPEC M6): tipo de venta y cliente → orden en borrador (D26). */
export default async function NuevaVenta() {
  await exigirRol('admin', 'vendedor');
  const supabase = await createClient();
  const { data } = await supabase.from('price_margins').select('tipo_venta, cantidad_minima');
  const minimos = Object.fromEntries((data ?? []).map((m) => [m.tipo_venta, m.cantidad_minima]));
  return (
    <>
      <Encabezado titulo="Nueva venta" descripcion="Elige la escala y registra al cliente; luego agrega unidades y pagos." />
      <FormularioNuevaVenta minimos={minimos} />
    </>
  );
}
