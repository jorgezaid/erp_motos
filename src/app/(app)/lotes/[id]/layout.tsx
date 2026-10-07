import Link from 'next/link';
import { Encabezado } from '@/components/encabezado';
import { EstadoLote } from '@/components/estado-badge';
import { exigirRol } from '@/lib/auth';
import { formatFechaHora } from '@/lib/format';
import { obtenerLote } from './datos';
import { PestanasLote } from './pestanas';

export default async function LayoutLote({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await exigirRol('admin');
  const { id } = await params;
  const lote = await obtenerLote(id);

  return (
    <>
      <p className="mb-2 text-sm text-muted-foreground">
        <Link href="/lotes" className="hover:underline">
          Lotes
        </Link>{' '}
        / {lote.codigo_embarque}
      </p>
      <Encabezado
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            Lote {lote.codigo_embarque} <EstadoLote estado={lote.estado} />
          </span>
        }
        descripcion={
          lote.estado === 'liquidado'
            ? `Liquidado el ${formatFechaHora(lote.liquidado_at)}: costos congelados (RN-08).`
            : [lote.proveedor, lote.nro_dam && `DAM ${lote.nro_dam}`].filter(Boolean).join(' · ') || undefined
        }
      />
      <PestanasLote id={lote.id} />
      {children}
    </>
  );
}
