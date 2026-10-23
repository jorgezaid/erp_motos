/**
 * Costeo de un lote de compra local (D41): motos compradas a un proveedor de Lima, en soles.
 *
 * Función pura, como `calcularProrrateo` (SPEC §7), y con la misma salida (`FilaCosteo`), que
 * la RPC `guardar_costeo` vuelve a validar en SQL:
 *   total_lineaᵢ = qᵢ × precio de compra unitario
 *   con IGV incluido: compraᵢ = total_lineaᵢ ÷ 1.18 (4 decimales) e IGVᵢ = total_lineaᵢ − compraᵢ
 *   sin IGV incluido: compraᵢ = total_lineaᵢ e IGVᵢ = compraᵢ × 0.18 (4 decimales)
 *   impuestos_asignados_pen = IGVᵢ solo si el IGV va al costo (`impuestos_recuperables_al_costo`)
 *   flete Lima→Arequipa y otros gastos: por cantidad, con el residuo a la línea de mayor cantidad
 *   (en empate, la primera por `codigo_modelo`)
 *   armado_pen = qᵢ × armado por unidad
 * Los conceptos de importación (FOB, fletes y agente en US$, alquiler, sueldos, publicidad) van en 0
 * y el tipo de cambio es 1.
 */
import { Decimal } from '@/lib/decimal';
import { ErrorProrrateo, type FilaCosteo, type Valor } from './prorrateo';

/** IGV del Perú (16 % + 2 % de IPM). */
export const TASA_IGV = '0.18';

export type LoteCompraLocal = {
  precio_incluye_igv: boolean;
  /** `impuestos_recuperables_al_costo`: true = el IGV se carga al costo */
  igv_al_costo: boolean;
  flete_nacional_pen: Valor;
  otros_gastos_pen: Valor;
  costo_armado_unitario_pen: Valor;
};

export type LineaCompraLocal = {
  model_id: string;
  codigo_modelo: string;
  cantidad_packing_list: number;
  precio_compra_unitario_pen: Valor | null | undefined;
};

const DECIMALES = 4;
const CERO = '0.0000';

const ETIQUETAS: Record<'flete_nacional_pen' | 'otros_gastos_pen' | 'costo_armado_unitario_pen', string> = {
  flete_nacional_pen: 'flete Lima → Arequipa (S/)',
  otros_gastos_pen: 'otros gastos (S/)',
  costo_armado_unitario_pen: 'costo de armado por unidad (S/)',
};

function aDecimal(valor: Valor | null | undefined): Decimal | null {
  if (valor === null || valor === undefined || valor === '') return null;
  try {
    const d = new Decimal(valor);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function monto(lote: LoteCompraLocal, campo: keyof typeof ETIQUETAS): Decimal {
  const d = aDecimal(lote[campo]);
  if (!d || d.isNegative() || d.decimalPlaces() > 2) {
    throw new ErrorProrrateo(
      'LOTE_INVALIDO',
      `El monto de ${ETIQUETAS[campo]} no es válido: debe ser un número mayor o igual a 0 con hasta 2 decimales.`,
    );
  }
  return d;
}

type Linea = { model_id: string; codigo: string; q: number; precio: Decimal };

function validarLineas(lineas: readonly LineaCompraLocal[]): Linea[] {
  const vistas = new Set<string>();
  const validadas = lineas.map((l) => {
    const codigo = l.codigo_modelo;
    if (!Number.isInteger(l.cantidad_packing_list) || l.cantidad_packing_list <= 0) {
      throw new ErrorProrrateo(
        'LINEA_INVALIDA',
        `Modelo ${codigo}: la cantidad debe ser un número entero mayor que 0.`,
      );
    }
    const precio = aDecimal(l.precio_compra_unitario_pen);
    if (!precio || precio.isNegative() || precio.decimalPlaces() > 2) {
      throw new ErrorProrrateo(
        'LINEA_INVALIDA',
        `Modelo ${codigo}: indica el precio de compra unitario (número mayor o igual a 0 con hasta 2 decimales).`,
      );
    }
    if (vistas.has(l.model_id) || vistas.has(codigo)) {
      throw new ErrorProrrateo(
        'LINEA_INVALIDA',
        `El modelo ${codigo} aparece más de una vez: únelo en una sola línea.`,
      );
    }
    vistas.add(l.model_id);
    vistas.add(codigo);
    return { model_id: l.model_id, codigo, q: l.cantidad_packing_list, precio };
  });
  // Mismo orden que el prorrateo: por código, comparando unidades de código (invariante 3)
  return validadas.sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0));
}

/** Reparto por cantidad con el residuo a la línea de mayor cantidad (la primera en empate). */
function repartirPorCantidad(total: Decimal, lineas: readonly Linea[]): Decimal[] {
  const suma = lineas.reduce((s, l) => s + l.q, 0);
  const partes = lineas.map((l) => total.times(l.q).div(suma).toDecimalPlaces(DECIMALES));
  const residuo = partes.reduce((r, p) => r.minus(p), total);
  const receptora = lineas.reduce((mayor, l, i, todas) => (l.q > (todas[mayor]?.q ?? 0) ? i : mayor), 0);
  return partes.map((p, i) => (i === receptora ? p.plus(residuo) : p));
}

/**
 * Calcula el costeo de una compra local. Lanza `ErrorProrrateo` si los datos no permiten
 * costear; en ese caso no se debe guardar nada.
 */
export function calcularCosteoCompraLocal(lote: LoteCompraLocal, lineas: readonly LineaCompraLocal[]): FilaCosteo[] {
  if (lineas.length === 0) {
    throw new ErrorProrrateo(
      'SIN_LINEAS',
      'La compra no tiene ítems. Agrega al menos un modelo antes de calcular el costeo.',
    );
  }
  const flete = monto(lote, 'flete_nacional_pen');
  const otros = monto(lote, 'otros_gastos_pen');
  const armado = monto(lote, 'costo_armado_unitario_pen');
  const validadas = validarLineas(lineas);
  const fletes = repartirPorCantidad(flete, validadas);
  const otrosGastos = repartirPorCantidad(otros, validadas);
  const divisorIgv = new Decimal(1).plus(TASA_IGV);

  return validadas.map((l, i) => {
    const totalLinea = l.precio.times(l.q);
    const compra = lote.precio_incluye_igv ? totalLinea.div(divisorIgv).toDecimalPlaces(DECIMALES) : totalLinea;
    const igv = lote.precio_incluye_igv
      ? totalLinea.minus(compra)
      : totalLinea.times(TASA_IGV).toDecimalPlaces(DECIMALES);
    return {
      model_id: l.model_id,
      cantidad: l.q,
      tipo_cambio: '1.0000',
      fob_asignado_usd: CERO,
      impuestos_asignados_pen: lote.igv_al_costo ? igv.toFixed(DECIMALES) : CERO,
      flete_internacional_asignado_usd: CERO,
      gastos_agente_asignado_usd: CERO,
      flete_nacional_asignado_pen: (fletes[i] ?? flete).toFixed(DECIMALES),
      alquiler_asignado_pen: CERO,
      sueldos_asignado_pen: CERO,
      publicidad_asignada_pen: CERO,
      armado_pen: armado.times(l.q).toFixed(DECIMALES),
      compra_asignada_pen: compra.toFixed(DECIMALES),
      otros_gastos_asignado_pen: (otrosGastos[i] ?? otros).toFixed(DECIMALES),
    };
  });
}
