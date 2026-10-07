/** Lotes de importación (SPEC M3). Solo admin. */
import { z } from 'zod';
import { decimal, decimalOpcional, fechaOpcional, textoOpcional, textoRequerido } from './comunes';

/** DAM de SUNAT, p. ej. 118-2026-10-361056-01-0-00 (se valida el formato general, no el dígito). */
const PATRON_DAM = /^\d{3}-\d{4}-\d{2}-\d{6}-\d{2}-\d-\d{2}$/;

export const ESTADOS_LOTE_EDITABLES = ['en_transito', 'en_aduanas', 'en_almacen'] as const;

export const esquemaDatosLote = z
  .object({
    codigo_embarque: textoRequerido('Código de embarque', 40).transform((v) => v.toUpperCase()),
    nro_dam: textoOpcional('N.º de DAM', 40).refine(
      (v) => v === null || PATRON_DAM.test(v),
      'N.º de DAM: formato 118-2026-10-361056-01-0-00.',
    ),
    proveedor: textoOpcional('Proveedor', 120),
    fecha_embarque: fechaOpcional('Fecha de embarque'),
    fecha_llegada: fechaOpcional('Fecha de llegada'),
    estado: z.enum(ESTADOS_LOTE_EDITABLES, 'Elige el estado del lote.'),
    notas: textoOpcional('Notas', 2000),
  })
  .refine((d) => !d.fecha_embarque || !d.fecha_llegada || d.fecha_llegada >= d.fecha_embarque, {
    message: 'La fecha de llegada no puede ser anterior a la de embarque.',
    path: ['fecha_llegada'],
  });

export type EntradaDatosLote = z.input<typeof esquemaDatosLote>;

/** Para crear un lote basta el código; el resto se completa en las pestañas. */
export const esquemaNuevoLote = z.object({
  codigo_embarque: textoRequerido('Código de embarque', 40).transform((v) => v.toUpperCase()),
  proveedor: textoOpcional('Proveedor', 120),
});

export type EntradaNuevoLote = z.input<typeof esquemaNuevoLote>;

const monto = (etiqueta: string) => decimal(etiqueta, { escala: 2 });

export const esquemaCostosLote = z.object({
  tipo_cambio: decimalOpcional('Tipo de cambio', { escala: 4, positivo: true }),
  fob_total_usd: monto('FOB total'),
  flete_internacional_usd: monto('Flete internacional'),
  gastos_agente_usd: monto('Gastos del agente'),
  ad_valorem_pen: monto('Ad Valorem'),
  igv_pen: monto('IGV'),
  ipm_pen: monto('IPM'),
  percepcion_pen: monto('Percepción'),
  impuestos_recuperables_al_costo: z.boolean(),
  flete_nacional_pen: monto('Flete nacional'),
  alquiler_periodo_pen: monto('Alquiler del periodo'),
  sueldos_periodo_pen: monto('Sueldos del periodo'),
  publicidad_inicial_pen: monto('Publicidad inicial'),
  costo_armado_unitario_pen: monto('Costo de armado por unidad'),
});

export type EntradaCostosLote = z.input<typeof esquemaCostosLote>;
export type CostosLote = z.output<typeof esquemaCostosLote>;

export const esquemaLineaPacking = z.object({
  model_id: z.uuid('Elige un modelo.'),
  cantidad_packing_list: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Cantidad del packing list: número entero.')
    .transform(Number)
    .refine((n) => n > 0, 'Cantidad del packing list: debe ser mayor que 0.'),
  cantidad_dam: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d+$/.test(v), 'Cantidad en la DAM: número entero.')
    .transform((v) => (v === '' ? null : Number(v))),
  exw_usd_unitario: monto('EXW unitario'),
  volumen_cbm_unitario: decimal('CBM unitario', { escala: 4, positivo: true }),
});

export type EntradaLineaPacking = z.input<typeof esquemaLineaPacking>;
