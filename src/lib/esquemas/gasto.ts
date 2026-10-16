/** Gastos del negocio (SPEC M9). La BD vuelve a validar RN-21 con sus CHECK. */
import { z } from 'zod';
import { decimal, fechaOpcional, textoOpcional, textoRequerido } from './comunes';

export const CATEGORIAS_GASTO = [
  'local_infraestructura',
  'publicidad',
  'servicios',
  'transporte',
  'sueldos',
  'alquiler',
  'otros',
] as const;
export const METODOS_PAGO_GASTO = ['efectivo', 'transferencia', 'tarjeta'] as const;

/** numeric(14,2): hasta 12 dígitos enteros. */
function montoPen(etiqueta: string) {
  return decimal(etiqueta, { escala: 2, positivo: true }).refine(
    (v) => (v.split('.')[0] ?? '').replace(/^0+(?=\d)/, '').length <= 12,
    `${etiqueta}: el monto es demasiado grande.`,
  );
}

function fechaRequerida(etiqueta: string) {
  return fechaOpcional(etiqueta).refine((v) => v !== null, `${etiqueta}: es obligatoria.`);
}

const metodoPago = z.enum(METODOS_PAGO_GASTO, 'Elige el método de pago.');

/**
 * Alta y edición. RN-21: un realizado exige la fecha del pago y el método; un planificado, la
 * fecha estimada (y se guarda sin fecha de pago).
 */
export const esquemaGasto = z
  .object({
    estado: z.enum(['planificado', 'realizado'], 'Elige el estado.'),
    fecha: fechaOpcional('Fecha de pago'),
    fecha_estimada: fechaOpcional('Fecha estimada'),
    categoria: z.enum(CATEGORIAS_GASTO, 'Elige la categoría.'),
    descripcion: textoRequerido('Descripción', 500),
    proveedor: textoOpcional('Proveedor', 200),
    monto_pen: montoPen('Monto'),
    metodo_pago: z.union([z.literal('').transform(() => null), metodoPago]),
  })
  .superRefine((g, ctx) => {
    if (g.estado === 'realizado') {
      if (!g.fecha) ctx.addIssue({ code: 'custom', path: ['fecha'], message: 'Fecha de pago: es obligatoria en un gasto realizado.' });
      if (!g.metodo_pago)
        ctx.addIssue({ code: 'custom', path: ['metodo_pago'], message: 'Método de pago: es obligatorio en un gasto realizado.' });
    } else if (!g.fecha_estimada) {
      ctx.addIssue({ code: 'custom', path: ['fecha_estimada'], message: 'Fecha estimada: es obligatoria en un gasto planificado.' });
    }
  })
  .transform((g) => (g.estado === 'planificado' ? { ...g, fecha: null } : g));

export type EntradaGasto = z.input<typeof esquemaGasto>;
export type Gasto = z.output<typeof esquemaGasto>;

export function gastoVacio(hoy: string): EntradaGasto {
  return {
    estado: 'realizado',
    fecha: hoy,
    fecha_estimada: '',
    categoria: 'otros',
    descripcion: '',
    proveedor: '',
    monto_pen: '',
    metodo_pago: '',
  };
}

/** "Marcar como realizado" (RN-21): monto real, fecha del pago y método. */
export const esquemaRealizado = z.object({
  monto_pen: montoPen('Monto real'),
  fecha: fechaRequerida('Fecha de pago'),
  metodo_pago: metodoPago,
});

export type EntradaRealizado = z.input<typeof esquemaRealizado>;
