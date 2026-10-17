'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { exigirRol } from '@/lib/auth';
import { exito, fallo, falloValidacion, mensajeDeError, sinFilasAfectadas, type Resultado } from '@/lib/errores';
import { normalizarSerial } from '@/lib/registro';
import { createClient } from '@/lib/supabase/server';
import { esSerialProvisional } from '@/lib/taller';

/** Saca la unidad de la caja: en_caja → en_ensamble (SPEC §9). */
export async function iniciarEnsamble(vehicleId: string): Promise<Resultado> {
  await exigirRol('admin', 'tecnico');
  if (!z.uuid().safeParse(vehicleId).success) return fallo('Unidad no válida.');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicle_inventory')
    .update({ estado: 'en_ensamble' })
    .eq('id', vehicleId)
    .eq('estado', 'en_caja')
    .select('id');
  if (error) return fallo(mensajeDeError(error));
  if (sinFilasAfectadas(data)) return fallo('La unidad ya no está en caja (otro técnico pudo haberla movido).');
  revalidatePath('/taller', 'layout');
  return exito(null);
}

const esquemaListoRapido = z.object({
  ubicacionId: z.uuid('Elige la ubicación en tienda.'),
  unidades: z
    .array(
      z.object({
        vehicleId: z.uuid('Unidad no válida.'),
        seriales: z
          .array(
            z.object({
              posicion: z.number().int().min(1).max(6),
              serial: z
                .string()
                .transform(normalizarSerial)
                .pipe(z.string().max(40, 'Serial: máximo 40 caracteres.'))
                .refine((s) => !esSerialProvisional(s), 'El prefijo PROV- está reservado a los seriales provisionales.'),
            }),
          )
          .max(6),
      }),
    )
    .min(1, 'Elige al menos una moto.')
    .max(100, 'Listo rápido admite hasta 100 motos a la vez.'),
});

export type EntradaListoRapido = z.input<typeof esquemaListoRapido>;

/**
 * D37: «Listo rápido» (RN-02, RN-10, RN-11): ensamble, baterías (las vacías como PROV-<VIN>-<n>),
 * inspección completa y tienda, todo o nada en la RPC `listo_rapido`, que respeta los triggers.
 */
export async function listoRapido(
  entrada: EntradaListoRapido,
): Promise<Resultado<{ unidades: number; provisionales: number }>> {
  await exigirRol('admin', 'tecnico');
  const d = esquemaListoRapido.safeParse(entrada);
  if (!d.success) return falloValidacion(d.error);

  const escritos = d.data.unidades.flatMap((u) => u.seriales.map((s) => s.serial).filter(Boolean));
  const repetido = escritos.find((s, i) => escritos.indexOf(s) !== i);
  if (repetido) return fallo(`El serial ${repetido} está repetido.`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('listo_rapido', {
    p_location_id: d.data.ubicacionId,
    p_unidades: d.data.unidades.map((u) => ({
      vehicle_id: u.vehicleId,
      seriales: u.seriales.filter((s) => s.serial).map((s) => ({ posicion: s.posicion, serial: s.serial })),
    })),
  });
  if (error) return fallo(mensajeDeError(error));
  const r = data as { unidades: number; provisionales: number };
  revalidatePath('/taller', 'layout');
  revalidatePath('/inventario');
  return exito({ unidades: r.unidades, provisionales: r.provisionales });
}
