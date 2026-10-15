import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { exigirRol } from '@/lib/auth';
import { leerEscalas } from '@/lib/consultas/escalas';
import { minimosPorTipo, tiposActivos } from '@/lib/escalas';
import { FormularioNuevaVenta } from './formulario-nueva';

export const metadata: Metadata = { title: 'Nueva venta · ERP Vehículos Eléctricos' };

/** /ventas/nueva (SPEC M6): tipo de venta y cliente → orden en borrador (D26). Solo escalas activas (D31). */
export default async function NuevaVenta() {
  await exigirRol('admin', 'vendedor');
  const escalas = await leerEscalas();
  return (
    <>
      <Encabezado titulo="Nueva venta" descripcion="Elige la escala y registra al cliente; luego agrega unidades y pagos." />
      <FormularioNuevaVenta activas={tiposActivos(escalas)} minimos={minimosPorTipo(escalas)} />
    </>
  );
}
