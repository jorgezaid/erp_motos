import { Encabezado } from '@/components/encabezado';
import { exigirRol } from '@/lib/auth';
import { MODELO_VACIO } from '@/lib/esquemas/modelo';
import { FormularioModelo } from '../formulario-modelo';

export default async function NuevoModelo() {
  await exigirRol('admin');
  return (
    <>
      <Encabezado titulo="Nuevo modelo" />
      <FormularioModelo inicial={MODELO_VACIO} />
    </>
  );
}
