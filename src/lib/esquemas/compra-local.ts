/** Compras locales (D41): lote `compra_local` en soles, con factura del proveedor. Solo admin. */
import { z } from 'zod';
import { decimal, fechaOpcional, textoOpcional, textoRequerido } from './comunes';
import { esquemaProveedor } from './proveedor';

/** Una compra local no pasa por aduanas (CHECK `import_batches_compra_local_check`). */
export const ESTADOS_COMPRA_LOCAL_EDITABLES = ['en_transito', 'en_almacen'] as const;

/** Valor del selector de proveedor para registrarlo en el mismo diálogo. */
export const PROVEEDOR_NUEVO = 'nuevo';

const codigo = textoRequerido('Código', 40).transform((v) => v.toUpperCase());
const factura = textoRequerido('N.º de factura', 40).transform((v) => v.toUpperCase());
const fechaCompra = fechaOpcional('Fecha de compra').refine((v) => v !== null, 'Fecha de compra: es obligatoria.');

/** Código sugerido del lote: `CL-<factura>` en mayúsculas y sin espacios (editable). */
export function codigoCompraLocal(nroFactura: string): string {
  const limpia = nroFactura.toUpperCase().replace(/\s+/g, '');
  return limpia ? `CL-${limpia}`.slice(0, 40) : '';
}

export const esquemaNuevaCompraLocal = z
  .object({
    proveedor_id: z.union([z.literal(PROVEEDOR_NUEVO), z.uuid('Elige el proveedor.')], 'Elige el proveedor.'),
    proveedor_nombre: z.string(),
    proveedor_ruc: z.string(),
    nro_factura: factura,
    codigo_embarque: codigo,
    fecha_compra: fechaCompra,
    precio_incluye_igv: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.proveedor_id !== PROVEEDOR_NUEVO) return;
    // Mismas reglas que /admin/proveedores
    const p = esquemaProveedor.safeParse({ nombre: d.proveedor_nombre, ruc: d.proveedor_ruc, telefono: '', activo: true });
    for (const issue of p.error?.issues ?? []) {
      ctx.addIssue({ code: 'custom', message: issue.message, path: [`proveedor_${String(issue.path[0])}`] });
    }
  });

export type EntradaNuevaCompraLocal = z.input<typeof esquemaNuevaCompraLocal>;

export const esquemaDatosCompraLocal = z
  .object({
    codigo_embarque: codigo,
    nro_factura: factura,
    proveedor_id: z.uuid('Elige el proveedor.'),
    fecha_compra: fechaCompra,
    fecha_llegada: fechaOpcional('Fecha de llegada'),
    estado: z.enum(ESTADOS_COMPRA_LOCAL_EDITABLES, 'Elige el estado de la compra.'),
    notas: textoOpcional('Notas', 2000),
  })
  .refine((d) => !d.fecha_compra || !d.fecha_llegada || d.fecha_llegada >= d.fecha_compra, {
    message: 'La fecha de llegada no puede ser anterior a la de compra.',
    path: ['fecha_llegada'],
  });

export type EntradaDatosCompraLocal = z.input<typeof esquemaDatosCompraLocal>;

const monto = (etiqueta: string) => decimal(etiqueta, { escala: 2 });

export const esquemaCostosCompraLocal = z.object({
  precio_incluye_igv: z.boolean(),
  impuestos_recuperables_al_costo: z.boolean(),
  flete_nacional_pen: monto('Flete Lima → Arequipa'),
  otros_gastos_pen: monto('Otros gastos'),
  costo_armado_unitario_pen: monto('Armado por unidad'),
});

export type EntradaCostosCompraLocal = z.input<typeof esquemaCostosCompraLocal>;

export const esquemaItemCompraLocal = z.object({
  model_id: z.uuid('Elige un modelo.'),
  cantidad_packing_list: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Cantidad: número entero.')
    .transform(Number)
    .refine((n) => n > 0, 'Cantidad: debe ser mayor que 0.'),
  precio_compra_unitario_pen: decimal('Precio unitario', { escala: 2, positivo: true }),
});

export type EntradaItemCompraLocal = z.input<typeof esquemaItemCompraLocal>;
