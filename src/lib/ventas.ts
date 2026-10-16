/**
 * Punto de venta (SPEC M6). La BD es la autoridad (RN-12 a RN-18): esto da la experiencia de
 * usuario — saldo pendiente, mínimos por escala y validación de documentos (RN-20).
 */
import { z } from 'zod';
import { Decimal } from '@/lib/decimal';
import { hoyLima } from '@/lib/format';
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

export type TipoDocumento = 'DNI' | 'RUC' | 'CE';

/** RN-20 (igual que el CHECK `documento_valido`); el documento ya sin espacios y en mayúsculas. */
export function documentoValido(tipo: TipoDocumento, documento: string): boolean {
  return (
    (tipo === 'DNI' && /^\d{8}$/.test(documento)) ||
    (tipo === 'RUC' && /^(10|15|17|20)\d{9}$/.test(documento)) ||
    (tipo === 'CE' && /^[A-Z0-9]{8,12}$/.test(documento))
  );
}

/** Documento tal como se guarda: sin espacios y en mayúsculas. */
export function normalizarDocumento(documento: string): string {
  return documento.replace(/\s+/g, '').toUpperCase();
}

/** Días de calendario de Lima entre dos instantes (para la antigüedad de un borrador). */
function diasLima(desde: string | Date, ahora: Date): number {
  const dia = (d: Date) => Date.parse(`${hoyLima(d)}T00:00:00Z`);
  return Math.max(0, Math.round((dia(ahora) - dia(new Date(desde))) / 86_400_000));
}

/** «hoy», «ayer» o «hace N días», según el calendario de Lima. */
export function antiguedad(desde: string | Date, ahora: Date = new Date()): string {
  const dias = diasLima(desde, ahora);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

/** «1 moto reservada», «3 motos reservadas», «sin motos reservadas». */
export function motosReservadas(n: number): string {
  if (n === 0) return 'sin motos reservadas';
  return n === 1 ? '1 moto reservada' : `${n} motos reservadas`;
}

/** Edita la orden la BD si es admin o su vendedor (`can_edit_order`); aquí solo para la UX. */
export function puedeEditarOrden(orden: { vendedor_id: string | null }, sesion: { userId: string; esAdmin: boolean }): boolean {
  return sesion.esAdmin || orden.vendedor_id === sesion.userId;
}

/**
 * Aviso del Inicio: «Tienes N ventas en borrador», con la antigüedad del más viejo y las motos
 * que tienen reservadas (un borrador olvidado bloquea stock). null si no hay borradores.
 */
export function avisoBorradores(
  borradores: readonly { created_at: string; motos: number }[],
  ahora: Date = new Date(),
): string | null {
  const [primero] = borradores;
  if (!primero) return null;
  const n = borradores.length;
  const masViejo = borradores.reduce((a, b) => (b.created_at < a ? b.created_at : a), primero.created_at);
  const motos = borradores.reduce((s, b) => s + b.motos, 0);
  const cabeza = n === 1 ? 'Tienes 1 venta en borrador' : `Tienes ${n} ventas en borrador`;
  const edad = n === 1 ? `creada ${antiguedad(masViejo, ahora)}` : `la más antigua, ${antiguedad(masViejo, ahora)}`;
  return `${cabeza} (${edad}; ${motosReservadas(motos)}).`;
}

export type OrdenDelCliente = {
  id: string;
  numero: number;
  estado: 'borrador' | 'confirmada' | 'anulada';
  created_at: string;
  vendedor_id: string | null;
  vendedor: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cliente_email: string | null;
  motos: number;
};

export type ClienteConocido = {
  /** Borrador más reciente del cliente (para no duplicarlo). */
  borrador: { id: string; numero: number; vendedor: string; puedeContinuar: boolean; antiguedad: string; motos: number } | null;
  /** Datos de la venta más reciente no anulada, para autocompletar. */
  datos: { numero: number; nombre: string; telefono: string; email: string } | null;
};

/** Lo que ya se sabe de un cliente por sus órdenes anteriores (mismo tipo y n.º de documento). */
export function analizarCliente(
  ordenes: readonly OrdenDelCliente[],
  sesion: { userId: string; esAdmin: boolean },
  ahora: Date = new Date(),
): ClienteConocido {
  const recientes = [...ordenes].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.numero - a.numero);
  const b = recientes.find((o) => o.estado === 'borrador');
  const d = recientes.find((o) => o.estado !== 'anulada');
  return {
    borrador: b
      ? {
          id: b.id,
          numero: b.numero,
          vendedor: b.vendedor,
          puedeContinuar: puedeEditarOrden(b, sesion),
          antiguedad: antiguedad(b.created_at, ahora),
          motos: b.motos,
        }
      : null,
    datos: d ? { numero: d.numero, nombre: d.cliente_nombre, telefono: d.cliente_telefono ?? '', email: d.cliente_email ?? '' } : null,
  };
}

export const esquemaCliente = z
  .object({
    cliente_nombre: z.string().trim().min(1, 'Nombre del cliente: es obligatorio.').max(150),
    cliente_tipo_documento: z.enum(['DNI', 'RUC', 'CE'], 'Elige el tipo de documento.'),
    cliente_documento: z.string().transform(normalizarDocumento),
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
    if (!documentoValido(c.cliente_tipo_documento, c.cliente_documento)) {
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
