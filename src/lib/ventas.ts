/**
 * Punto de venta (SPEC M6). La BD es la autoridad (RN-12 a RN-18): esto da la experiencia de
 * usuario — saldo pendiente, mínimos por escala y validación de documentos (RN-20).
 */
import { z } from 'zod';
import { Decimal } from '@/lib/decimal';
import type { Valor } from '@/lib/costing/prorrateo';

export type TipoVenta = 'unidad_x1' | 'mayorista_x3' | 'distribuidor_x6';
export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta';

const NOMBRE_ESCALA: Record<TipoVenta, string> = {
  unidad_x1: 'minorista',
  mayorista_x3: 'mayorista',
  distribuidor_x6: 'distribuidor',
};

/** Minúsculas y sin tildes, para buscar sin distinguir "Gris" de "gris" ni "Azúl" de "azul". */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/**
 * Búsqueda del POS (SPEC M6): cada palabra debe aparecer en el VIN, el modelo o un color
 * («XSDU-29 gris»), sin distinguir mayúsculas ni tildes. Sin palabras, devuelve todo.
 */
export function filtrarUnidades<
  U extends { vin_chasis: string | null; codigo_modelo: string | null; color_primario: string | null; color_secundario: string | null },
>(unidades: readonly U[], q: string): U[] {
  const palabras = normalizarBusqueda(q).split(/\s+/).filter(Boolean);
  return unidades.filter((u) => {
    const campos = [u.vin_chasis, u.codigo_modelo, u.color_primario, u.color_secundario].map((c) => normalizarBusqueda(c ?? ''));
    return palabras.every((p) => campos.some((c) => c.includes(p)));
  });
}

/** Σ de montos con decimal.js (CLAUDE.md regla 4). */
export function sumar(montos: readonly Valor[]): string {
  return montos.reduce<Decimal>((s, m) => s.plus(m), new Decimal(0)).toFixed(2);
}

/** Saldo = total − Σ pagos (negativo si se pagó de más). */
export function saldoPendiente(total: Valor, pagos: readonly { monto_pen: Valor }[]): string {
  return new Decimal(total).minus(sumar(pagos.map((p) => p.monto_pen))).toFixed(2);
}

/** M6: "Faltan 1 unidad para precio distribuidor" (null si ya se cumple el mínimo, RN-14). */
export function faltanParaEscala(tipo: TipoVenta, unidades: number, minimo: number): string | null {
  const faltan = minimo - unidades;
  if (faltan <= 0) return null;
  return `Faltan ${faltan} ${faltan === 1 ? 'unidad' : 'unidades'} para precio ${NOMBRE_ESCALA[tipo]}`;
}

/** RN-14: lo que falta para confirmar (vacío = se puede confirmar). `activa`: la escala está activa (D31). */
export function motivosNoConfirmable(o: {
  tipo: TipoVenta;
  unidades: number;
  minimo: number;
  total: Valor;
  pagos: readonly { monto_pen: Valor }[];
  activa?: boolean;
}): string[] {
  const motivos: string[] = [];
  if (o.activa === false) motivos.push(`La venta ${NOMBRE_ESCALA[o.tipo]} está desactivada: cambia el tipo de venta`);
  if (o.unidades === 0) motivos.push('Agrega al menos una unidad');
  else if (o.activa !== false) {
    const faltan = faltanParaEscala(o.tipo, o.unidades, o.minimo);
    if (faltan) motivos.push(faltan);
  }
  const saldo = new Decimal(saldoPendiente(o.total, o.pagos));
  if (saldo.gt(0)) motivos.push(`Falta cobrar S/ ${saldo.toFixed(2)}`);
  if (saldo.lt(0)) motivos.push(`Los pagos exceden el total en S/ ${saldo.neg().toFixed(2)}`);
  return motivos;
}

/** RN-15: un método si todos los pagos lo usan; `mixto` si hay más de uno. */
export function metodoDerivado(pagos: readonly { metodo: MetodoPago }[]): MetodoPago | 'mixto' | null {
  const [primero] = pagos;
  if (!primero) return null;
  return pagos.some((p) => p.metodo !== primero.metodo) ? 'mixto' : primero.metodo;
}

// ---------------------------------------------------------------- RN-20: cliente

export const esquemaCliente = z
  .object({
    cliente_nombre: z.string().trim().min(1, 'Nombre del cliente: es obligatorio.').max(150),
    cliente_tipo_documento: z.enum(['DNI', 'RUC', 'CE'], 'Elige el tipo de documento.'),
    cliente_documento: z.string().transform((v) => v.replace(/\s+/g, '').toUpperCase()),
    cliente_telefono: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\+?[\d\s-]{6,20}$/.test(v), 'Teléfono: solo números (6 a 20 dígitos).')
      .transform((v) => v || null),
    cliente_email: z
      .string()
      .trim()
      .refine((v) => v === '' || z.email().safeParse(v).success, 'Email: formato inválido.')
      .transform((v) => v || null),
  })
  .superRefine((c, ctx) => {
    const ok =
      (c.cliente_tipo_documento === 'DNI' && /^\d{8}$/.test(c.cliente_documento)) ||
      (c.cliente_tipo_documento === 'RUC' && /^(10|15|17|20)\d{9}$/.test(c.cliente_documento)) ||
      (c.cliente_tipo_documento === 'CE' && /^[A-Z0-9]{8,12}$/.test(c.cliente_documento));
    if (!ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['cliente_documento'],
        message: {
          DNI: 'DNI: 8 dígitos.',
          RUC: 'RUC: 11 dígitos que empiezan por 10, 15, 17 o 20.',
          CE: 'CE: de 8 a 12 letras o números.',
        }[c.cliente_tipo_documento],
      });
    }
  });

export type EntradaCliente = z.input<typeof esquemaCliente>;

/** Paso 1 de /ventas/nueva: tipo de venta + cliente. */
export const esquemaNuevaVenta = esquemaCliente.safeExtend({
  tipo_venta: z.enum(['unidad_x1', 'mayorista_x3', 'distribuidor_x6'], 'Elige el tipo de venta.'),
});

export type EntradaNuevaVenta = z.input<typeof esquemaNuevaVenta>;

export const esquemaPago = z.object({
  metodo: z.enum(['efectivo', 'transferencia', 'tarjeta'], 'Elige el método de pago.'),
  monto: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, '').replace(',', '.'))
    .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v) && new Decimal(v).gt(0), 'Monto: mayor que 0 con hasta 2 decimales.'),
  referencia: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null),
});

export type EntradaPago = z.input<typeof esquemaPago>;
