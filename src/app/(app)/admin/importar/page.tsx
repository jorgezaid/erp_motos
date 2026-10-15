import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { exigirRol } from '@/lib/auth';
import { Importador } from './importador';

export const metadata: Metadata = { title: 'Importar Excel · ERP Vehículos Eléctricos' };

/**
 * /admin/importar (tarea 11.1, D33): sube la plantilla de datos reales v2 llena, muestra qué se
 * crea o actualiza y los errores por hoja y fila, y la guarda todo o nada al confirmar.
 * No costea ni liquida: eso sigue en /lotes/[id].
 */
export default async function PaginaImportar() {
  await exigirRol('admin');
  return (
    <>
      <Encabezado
        titulo="Importar Excel"
        descripcion="Carga la plantilla de datos reales v2: ubicaciones, modelos, un lote con su packing list, sus unidades (en caja) y baterías."
      />
      <Importador />
    </>
  );
}
