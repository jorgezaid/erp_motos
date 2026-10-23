import { notFound } from 'next/navigation';
import { Encabezado } from '@/components/encabezado';
import { exigirRol } from '@/lib/auth';
import type { EntradaModelo } from '@/lib/esquemas/modelo';
import { createClient } from '@/lib/supabase/server';
import { FormularioModelo } from '../formulario-modelo';
import { BotonEliminarModelo } from './boton-eliminar';

export default async function EditarModelo({ params }: { params: Promise<{ id: string }> }) {
  await exigirRol('admin');
  const { id } = await params;
  const supabase = await createClient();
  const { data: m } = await supabase.from('vehicle_models').select('*').eq('id', id).maybeSingle();
  if (!m) notFound();

  const inicial: EntradaModelo = {
    codigo_modelo: m.codigo_modelo,
    nombre_comercial: m.nombre_comercial ?? '',
    categoria: m.categoria,
    voltaje_sistema: String(m.voltaje_sistema),
    amperaje_bateria_ah: String(m.amperaje_bateria_ah),
    potencia_motor_watts: String(m.potencia_motor_watts),
    volumen_cbm_unitario: m.volumen_cbm_unitario === null ? '' : String(m.volumen_cbm_unitario),
    exw_usd_unitario: m.exw_usd_unitario === null ? '' : String(m.exw_usd_unitario),
    garantia_meses: String(m.garantia_meses),
    garantia_baterias_meses: String(m.garantia_baterias_meses),
    tipo_bateria: m.tipo_bateria,
    baterias_litio: m.baterias_litio === null ? '' : String(m.baterias_litio),
    tiene_techo: m.tiene_techo,
    activo: m.activo,
  };

  return (
    <>
      <Encabezado titulo={`Modelo ${m.codigo_modelo}`}>
        <BotonEliminarModelo id={m.id} codigo={m.codigo_modelo} />
      </Encabezado>
      <FormularioModelo id={m.id} inicial={inicial} />
    </>
  );
}
