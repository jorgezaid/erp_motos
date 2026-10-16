import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { exigirRol } from '@/lib/auth';
import { BUCKET_COMPROBANTES } from '@/lib/gastos';
import { createClient } from '@/lib/supabase/server';

/**
 * Abre el comprobante de un gasto (RN-24): el bucket es privado, así que se redirige a una URL
 * firmada de 60 s. La ruta del archivo nunca viaja al navegador.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await exigirRol('admin');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse('Gasto no válido.', { status: 400 });

  const supabase = await createClient();
  const { data: gasto } = await supabase.from('gastos').select('comprobante_path').eq('id', id).maybeSingle();
  if (!gasto?.comprobante_path) return new NextResponse('El gasto no tiene comprobante.', { status: 404 });

  const { data, error } = await supabase.storage.from(BUCKET_COMPROBANTES).createSignedUrl(gasto.comprobante_path, 60);
  if (error || !data) return new NextResponse('No se pudo abrir el comprobante.', { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'no-store' } });
}
