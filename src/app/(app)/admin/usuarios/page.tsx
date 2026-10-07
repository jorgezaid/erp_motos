import type { Metadata } from 'next';
import { Encabezado } from '@/components/encabezado';
import { BarraFiltros } from '@/components/tabla/barra-filtros';
import { exigirRol } from '@/lib/auth';
import { leerParams } from '@/lib/tabla';
import { consultarUsuarios, ESTADOS_USUARIO } from './datos';
import { TablaUsuarios } from './tabla-usuarios';

export const metadata: Metadata = { title: 'Usuarios · ERP Vehículos Eléctricos' };

export default async function PaginaUsuarios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesion = await exigirRol('admin');
  const params = leerParams(await searchParams);
  const usuarios = await consultarUsuarios(params);

  return (
    <>
      <Encabezado
        titulo="Usuarios"
        descripcion="Asigna roles y activa o desactiva cuentas. Un usuario nuevo no ve nada hasta que le asignes un rol."
      />
      <BarraFiltros placeholder="Buscar por nombre o email" estados={ESTADOS_USUARIO} csvHref="/admin/usuarios/csv" />
      <TablaUsuarios usuarios={usuarios} yo={sesion.userId} />
      <p className="mt-2 text-sm text-muted-foreground">{usuarios.length} usuario(s)</p>
    </>
  );
}
