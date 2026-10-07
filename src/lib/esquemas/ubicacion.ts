/** Ubicaciones físicas (SPEC M2). */
import { z } from 'zod';
import { textoOpcional, textoRequerido } from './comunes';

export const esquemaUbicacion = z.object({
  nombre: textoRequerido('Nombre', 80),
  tipo: z.enum(['almacen', 'showroom', 'taller'], 'Elige el tipo de ubicación.'),
  direccion: textoOpcional('Dirección', 200),
  activo: z.boolean(),
});

export type EntradaUbicacion = z.input<typeof esquemaUbicacion>;

export const UBICACION_VACIA: EntradaUbicacion = { nombre: '', tipo: 'almacen', direccion: '', activo: true };
