/**
 * Vista previa de la matriz de precios x1/x3/x6 (RN-07, SPEC §8).
 *
 * Función pura: replica `public.generar_lista_precios` (precio sugerido), la columna generada
 * `price_list.precio_venta_pen` (manual si existe, si no el sugerido) y la utilidad de `v_price_matrix`.
 * La BD sigue siendo la autoridad: esto solo sirve para mostrar los precios antes de liquidar.
 * Usa costos: solo para admin (CLAUDE.md regla 5).
 */
import { Decimal } from '@/lib/decimal';
import type { Valor } from '@/lib/costing/prorrateo';

/** Enum `public.sale_type`. */
export type TipoVenta = 'unidad_x1' | 'mayorista_x3' | 'distribuidor_x6';

/** Fila de `public.price_margins`. */
export type MargenPrecio = {
  tipo_venta: TipoVenta;
  cantidad_minima: number;
  margen_objetivo: Valor;
};

/** Lo necesario de `batch_model_costs` (o de `calcularCostoUnitarioPen`) por modelo. */
export type CostoModelo = {
  model_id: string;
  codigo_modelo: string;
  costo_landing_unitario_pen: Valor;
  /** `price_list.precio_manual_pen` vigente, si lo hay. */
  precios_manuales?: Partial<Record<TipoVenta, Valor | null>>;
};

export type PrecioEscala = {
  tipo_venta: TipoVenta;
  cantidad_minima: number;
  margen_objetivo: string;
  precio_sugerido_pen: string;
  precio_manual_pen: string | null;
  precio_venta_pen: string;
  utilidad_pen: string;
  /** Margen real sobre el precio de venta, 4 decimales (como `v_sales_margin.margen_real`). */
  margen_real: string;
};

export type FilaMatrizPrecios = {
  model_id: string;
  codigo_modelo: string;
  costo_landing_unitario_pen: string;
  precios: PrecioEscala[];
};

export type CodigoErrorPrecios = 'COSTO_INVALIDO' | 'MARGEN_INVALIDO' | 'PRECIO_MANUAL_INVALIDO' | 'SIN_MARGENES';

/** Error de dominio: `message` está en español y se puede mostrar tal cual al usuario. */
export class ErrorPrecios extends Error {
  constructor(
    readonly codigo: CodigoErrorPrecios,
    message: string,
  ) {
    super(message);
    this.name = 'ErrorPrecios';
  }
}

// Escalas de las columnas en la BD (numeric(p, s)).
const DECIMALES_COSTO = 2;
const DECIMALES_MARGEN = 4;
const DECIMALES_PRECIO = 2;

const ORDEN_ESCALAS: readonly TipoVenta[] = ['unidad_x1', 'mayorista_x3', 'distribuidor_x6'];

function aDecimal(valor: Valor | null | undefined): Decimal | null {
  if (valor === null || valor === undefined || valor === '') return null;
  try {
    const d = new Decimal(valor);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function margenValido(m: MargenPrecio): Decimal {
  const d = aDecimal(m.margen_objetivo);
  if (!d || d.isNegative() || d.gte(1) || d.decimalPlaces() > DECIMALES_MARGEN) {
    throw new ErrorPrecios(
      'MARGEN_INVALIDO',
      `El margen de ${m.tipo_venta} no es válido: debe estar entre 0 y 0.9999, con hasta ${DECIMALES_MARGEN} decimales.`,
    );
  }
  return d;
}

/** El costo debe ser > 0: `price_list.precio_sugerido_pen` exige un precio positivo. */
function costoValido(valor: Valor): Decimal {
  const d = aDecimal(valor);
  if (!d || !d.isPositive() || d.isZero() || d.decimalPlaces() > DECIMALES_COSTO) {
    throw new ErrorPrecios(
      'COSTO_INVALIDO',
      `El costo unitario no es válido: debe ser mayor que 0, con hasta ${DECIMALES_COSTO} decimales.`,
    );
  }
  return d;
}

function precioSugerido(costo: Decimal, margen: Decimal): string {
  return costo.div(new Decimal(1).minus(margen)).toFixed(DECIMALES_PRECIO);
}

/** Precio sugerido = round(costo / (1 − margen), 2), half-up (igual que `round(numeric, 2)` de Postgres). */
export function calcularPrecioSugerido(costoUnitarioPen: Valor, margenObjetivo: Valor): string {
  return precioSugerido(
    costoValido(costoUnitarioPen),
    margenValido({ tipo_venta: 'unidad_x1', cantidad_minima: 1, margen_objetivo: margenObjetivo }),
  );
}

/**
 * Matriz completa por modelo, ordenada por `codigo_modelo`, con las escalas en orden x1, x3, x6
 * (solo las que vengan en `margenes`).
 */
export function calcularMatrizPrecios(
  costos: readonly CostoModelo[],
  margenes: readonly MargenPrecio[],
): FilaMatrizPrecios[] {
  if (margenes.length === 0) {
    throw new ErrorPrecios('SIN_MARGENES', 'No hay márgenes configurados: no se pueden calcular los precios.');
  }
  const escalas = [...margenes]
    .sort((a, b) => ORDEN_ESCALAS.indexOf(a.tipo_venta) - ORDEN_ESCALAS.indexOf(b.tipo_venta))
    .map((m) => ({ ...m, margen: margenValido(m) }));

  return [...costos]
    .sort((a, b) => (a.codigo_modelo < b.codigo_modelo ? -1 : a.codigo_modelo > b.codigo_modelo ? 1 : 0))
    .map((c) => {
      let costo: Decimal;
      try {
        costo = costoValido(c.costo_landing_unitario_pen);
      } catch (e) {
        if (e instanceof ErrorPrecios) {
          throw new ErrorPrecios(e.codigo, `Modelo ${c.codigo_modelo}: ${e.message}`);
        }
        throw e;
      }

      const precios = escalas.map(({ margen, ...m }): PrecioEscala => {
        const sugerido = precioSugerido(costo, margen);
        const manualCrudo = c.precios_manuales?.[m.tipo_venta];
        let manual: string | null = null;
        if (manualCrudo !== null && manualCrudo !== undefined && manualCrudo !== '') {
          const d = aDecimal(manualCrudo);
          if (!d || !d.isPositive() || d.isZero() || d.decimalPlaces() > DECIMALES_PRECIO) {
            throw new ErrorPrecios(
              'PRECIO_MANUAL_INVALIDO',
              `Modelo ${c.codigo_modelo}: el precio manual de ${m.tipo_venta} debe ser mayor que 0, con hasta ${DECIMALES_PRECIO} decimales.`,
            );
          }
          manual = d.toFixed(DECIMALES_PRECIO);
        }
        const venta = new Decimal(manual ?? sugerido);
        const utilidad = venta.minus(costo);
        return {
          tipo_venta: m.tipo_venta,
          cantidad_minima: m.cantidad_minima,
          margen_objetivo: margen.toFixed(DECIMALES_MARGEN),
          precio_sugerido_pen: sugerido,
          precio_manual_pen: manual,
          precio_venta_pen: venta.toFixed(DECIMALES_PRECIO),
          utilidad_pen: utilidad.toFixed(DECIMALES_PRECIO),
          margen_real: utilidad.div(venta).toFixed(4),
        };
      });

      return {
        model_id: c.model_id,
        codigo_modelo: c.codigo_modelo,
        costo_landing_unitario_pen: costo.toFixed(DECIMALES_COSTO),
        precios,
      };
    });
}
