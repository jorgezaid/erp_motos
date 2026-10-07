import { Encabezado } from '@/components/encabezado';
import { exigirRol } from '@/lib/auth';
import { ETIQUETA_ROL } from '@/lib/roles';

export default async function Inicio() {
  const sesion = await exigirRol();
  return (
    <Encabezado titulo={`Hola, ${sesion.nombre || sesion.email}`} descripcion={`Rol: ${ETIQUETA_ROL[sesion.rol]}`} />
  );
}
