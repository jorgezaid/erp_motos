'use client';

import { useRouter } from 'next/navigation';
import { BotonConfirmar } from '@/components/confirmar';
import { avisar } from '@/lib/toast';
import { eliminarModelo } from '../acciones';

export function BotonEliminarModelo({ id, codigo }: { id: string; codigo: string }) {
  const router = useRouter();
  return (
    <BotonConfirmar
      etiqueta="Eliminar"
      variante="destructive"
      titulo={`¿Eliminar el modelo ${codigo}?`}
      descripcion="Solo se puede eliminar si no figura en ningún lote. Si ya se usó, desactívalo para ocultarlo."
      confirmar="Eliminar"
      alConfirmar={async () => {
        const ok = avisar(await eliminarModelo(id), `Modelo ${codigo} eliminado`);
        if (ok) router.push('/admin/modelos');
        return ok;
      }}
    />
  );
}
