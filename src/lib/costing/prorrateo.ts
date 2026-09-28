/**
 * Prorrateo de costos de un lote de importación (RN-06, SPEC §7).
 *
 * Función pura: no toca Supabase. Recibe el lote y su packing list con los nombres de columna
 * de la BD y devuelve las filas de `batch_model_costs` listas para la RPC `guardar_costeo`.
 * Los montos salen como string con 4 decimales para no perder precisión en el jsonb.
 */
import { Decimal } from '@/lib/decimal';

/** Monto tal como puede llegar de PostgREST, de un formulario o de otro cálculo. */
export type Valor = string | number | Decimal;

export type LoteCosteo = {
  tipo_cambio: Valor | null | undefined;
  fob_total_usd: Valor;
  flete_internacional_usd: Valor;
  gastos_agente_usd: Valor;
  impuestos_asignables_pen: Valor;
  flete_nacional_pen: Valor;
  alquiler_periodo_pen: Valor;
  sueldos_periodo_pen: Valor;
  publicidad_inicial_pen: Valor;
  costo_armado_unitario_pen: Valor;
};

/** Una línea de `batch_items`, más el `codigo_modelo` para desempatar el residuo. */
export type LineaCosteo = {
  model_id: string;
  codigo_modelo: string;
  cantidad_packing_list: number;
  exw_total_usd: Valor;
  cbm_total: Valor;
};

type Criterio = 'exw' | 'cbm' | 'cantidad';

const CONCEPTOS = [
  { columna: 'fob_asignado_usd', total: 'fob_total_usd', criterio: 'exw' },
  { columna: 'impuestos_asignados_pen', total: 'impuestos_asignables_pen', criterio: 'exw' },
  { columna: 'flete_internacional_asignado_usd', total: 'flete_internacional_usd', criterio: 'cbm' },
  { columna: 'gastos_agente_asignado_usd', total: 'gastos_agente_usd', criterio: 'cbm' },
  { columna: 'flete_nacional_asignado_pen', total: 'flete_nacional_pen', criterio: 'cbm' },
  { columna: 'alquiler_asignado_pen', total: 'alquiler_periodo_pen', criterio: 'cantidad' },
  { columna: 'sueldos_asignado_pen', total: 'sueldos_periodo_pen', criterio: 'cantidad' },
  { columna: 'publicidad_asignada_pen', total: 'publicidad_inicial_pen', criterio: 'cantidad' },
] as const satisfies readonly { columna: string; total: keyof LoteCosteo; criterio: Criterio }[];

type ColumnaProrrateada = (typeof CONCEPTOS)[number]['columna'];
type MontoLote = Exclude<keyof LoteCosteo, 'tipo_cambio'>;

/** Columnas de `batch_model_costs` que llena el costeo (sin `batch_id`: lo pone la RPC). */
export type FilaCosteo = {
  model_id: string;
  cantidad: number;
  tipo_cambio: string;
  armado_pen: string;
} & Record<ColumnaProrrateada, string>;

export type CodigoErrorProrrateo =
  | 'SIN_LINEAS'
  | 'SIN_TIPO_CAMBIO'
  | 'EXW_CERO'
  | 'CBM_CERO'
  | 'LOTE_INVALIDO'
  | 'LINEA_INVALIDA';

/** Error de dominio: `message` está en español y se puede mostrar tal cual al usuario. */
export class ErrorProrrateo extends Error {
  constructor(
    readonly codigo: CodigoErrorProrrateo,
    message: string,
  ) {
    super(message);
    this.name = 'ErrorProrrateo';
  }
}

/** Nombres para el usuario de cada monto del lote (y la lista completa de montos a validar). */
const ETIQUETAS_LOTE: Record<MontoLote, string> = {
  fob_total_usd: 'FOB total (USD)',
  flete_internacional_usd: 'flete internacional (USD)',
  gastos_agente_usd: 'gastos del agente (USD)',
  impuestos_asignables_pen: 'impuestos asignables (S/)',
  flete_nacional_pen: 'flete nacional (S/)',
  alquiler_periodo_pen: 'alquiler del periodo (S/)',
  sueldos_periodo_pen: 'sueldos del periodo (S/)',
  publicidad_inicial_pen: 'publicidad inicial (S/)',
  costo_armado_unitario_pen: 'costo de armado por unidad (S/)',
};

// Escalas de las columnas de origen en la BD (numeric(p, s)).
const DECIMALES_MONTO_LOTE = 2;
const DECIMALES_TIPO_CAMBIO = 4;
const DECIMALES_EXW = 2;
const DECIMALES_CBM = 4;
const DECIMALES_ASIGNACION = 4;

/** Convierte a Decimal; devuelve null si no es un número finito. */
function aDecimal(valor: Valor): Decimal | null {
  try {
    const d = new Decimal(valor);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function montoLote(lote: LoteCosteo, campo: MontoLote): Decimal {
  const d = aDecimal(lote[campo]);
  if (!d || d.isNegative() || d.decimalPlaces() > DECIMALES_MONTO_LOTE) {
    throw new ErrorProrrateo(
      'LOTE_INVALIDO',
      `El monto de ${ETIQUETAS_LOTE[campo]} no es válido: debe ser un número mayor o igual a 0 con hasta ${DECIMALES_MONTO_LOTE} decimales.`,
    );
  }
  return d;
}

function tipoDeCambio(valor: LoteCosteo['tipo_cambio']): Decimal {
  if (valor === null || valor === undefined || valor === '') {
    throw new ErrorProrrateo('SIN_TIPO_CAMBIO', 'Falta el tipo de cambio del lote. Regístralo antes de calcular el costeo.');
  }
  const d = aDecimal(valor);
  if (!d || d.decimalPlaces() > DECIMALES_TIPO_CAMBIO) {
    throw new ErrorProrrateo(
      'LOTE_INVALIDO',
      `El tipo de cambio no es válido: debe ser un número con hasta ${DECIMALES_TIPO_CAMBIO} decimales.`,
    );
  }
  if (!d.isPositive() || d.isZero()) {
    throw new ErrorProrrateo('SIN_TIPO_CAMBIO', 'El tipo de cambio del lote debe ser mayor que 0.');
  }
  return d;
}

type LineaValidada = { model_id: string; codigo: string; q: number; exw: Decimal; cbm: Decimal };

function validarLinea(linea: LineaCosteo): LineaValidada {
  const codigo = linea.codigo_modelo;
  const q = linea.cantidad_packing_list;
  if (!Number.isInteger(q) || q <= 0) {
    throw new ErrorProrrateo('LINEA_INVALIDA', `Modelo ${codigo}: la cantidad del packing list debe ser un número entero mayor que 0.`);
  }
  const exw = aDecimal(linea.exw_total_usd);
  if (!exw || exw.isNegative() || exw.decimalPlaces() > DECIMALES_EXW) {
    throw new ErrorProrrateo(
      'LINEA_INVALIDA',
      `Modelo ${codigo}: el EXW total debe ser un número mayor o igual a 0 con hasta ${DECIMALES_EXW} decimales.`,
    );
  }
  const cbm = aDecimal(linea.cbm_total);
  if (!cbm || cbm.isNegative() || cbm.decimalPlaces() > DECIMALES_CBM) {
    throw new ErrorProrrateo(
      'LINEA_INVALIDA',
      `Modelo ${codigo}: el volumen total (CBM) debe ser un número mayor o igual a 0 con hasta ${DECIMALES_CBM} decimales.`,
    );
  }
  return { model_id: linea.model_id, codigo, q, exw, cbm };
}

function validarLineas(lineas: readonly LineaCosteo[]): LineaValidada[] {
  const validadas = lineas.map(validarLinea);
  const porModelId = new Map<string, string>();
  const codigos = new Set<string>();
  for (const l of validadas) {
    const previo = porModelId.get(l.model_id);
    if (previo !== undefined) {
      throw new ErrorProrrateo('LINEA_INVALIDA', `Las líneas ${previo} y ${l.codigo} corresponden al mismo modelo: únelas en una sola línea.`);
    }
    if (codigos.has(l.codigo)) {
      throw new ErrorProrrateo('LINEA_INVALIDA', `El modelo ${l.codigo} aparece más de una vez en el packing list: únelo en una sola línea.`);
    }
    porModelId.set(l.model_id, l.codigo);
    codigos.add(l.codigo);
  }
  // Orden por codigo_modelo comparando unidades de código (no localeCompare): es el mismo en
  // cualquier entorno, y garantiza que la salida no dependa del orden de entrada (invariante 3).
  return validadas.sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0));
}

function base(linea: LineaValidada, criterio: Criterio): Decimal {
  if (criterio === 'exw') return linea.exw;
  if (criterio === 'cbm') return linea.cbm;
  return new Decimal(linea.q);
}

/** Parte proporcional de `total` para la línea, redondeada a 4 decimales (half-up). */
function parte(total: Decimal, linea: LineaValidada, criterio: Criterio, sumaBases: Decimal): Decimal {
  return total.times(base(linea, criterio)).div(sumaBases).toDecimalPlaces(DECIMALES_ASIGNACION);
}

/** Línea de mayor base; en empate, la primera (las líneas vienen ordenadas por codigo_modelo). */
function lineaDeMayorBase(lineas: readonly LineaValidada[], criterio: Criterio): LineaValidada | undefined {
  return lineas.reduce<LineaValidada | undefined>(
    (mayor, l) => (mayor === undefined || base(l, criterio).greaterThan(base(mayor, criterio)) ? l : mayor),
    undefined,
  );
}

/**
 * Calcula el prorrateo del lote (SPEC §7). Lanza `ErrorProrrateo` si los datos no permiten
 * costear; en ese caso no se debe guardar nada.
 */
export function calcularProrrateo(lote: LoteCosteo, lineas: readonly LineaCosteo[]): FilaCosteo[] {
  if (lineas.length === 0) {
    throw new ErrorProrrateo('SIN_LINEAS', 'El lote no tiene líneas en el packing list. Agrega al menos un modelo antes de calcular el costeo.');
  }
  const totales = Object.fromEntries(
    (Object.keys(ETIQUETAS_LOTE) as MontoLote[]).map((campo) => [campo, montoLote(lote, campo)]),
  ) as Record<MontoLote, Decimal>;
  const tc = tipoDeCambio(lote.tipo_cambio);
  const validadas = validarLineas(lineas);

  const sumas: Record<Criterio, Decimal> = {
    exw: Decimal.sum(...validadas.map((l) => l.exw)),
    cbm: Decimal.sum(...validadas.map((l) => l.cbm)),
    cantidad: new Decimal(validadas.reduce((s, l) => s + l.q, 0)),
  };
  if (sumas.exw.isZero()) {
    throw new ErrorProrrateo('EXW_CERO', 'La suma del valor EXW del packing list es 0: no se pueden prorratear el FOB ni los impuestos.');
  }
  if (sumas.cbm.isZero()) {
    throw new ErrorProrrateo('CBM_CERO', 'La suma del volumen (CBM) del packing list es 0: no se pueden prorratear los fletes ni los gastos del agente.');
  }

  // Cuadre exacto: por concepto, el residuo de redondeo (total − Σ partes) va a la línea de
  // mayor base de su criterio, así Σ asignado = total del lote.
  const repartos = CONCEPTOS.map(({ columna, total, criterio }) => {
    const monto = totales[total];
    const suma = sumas[criterio];
    const residuo = validadas.reduce((resto, l) => resto.minus(parte(monto, l, criterio, suma)), monto);
    return { columna, monto, criterio, suma, residuo, receptora: lineaDeMayorBase(validadas, criterio) };
  });

  return validadas.map((linea) => {
    const asignado = Object.fromEntries(
      repartos.map(({ columna, monto, criterio, suma, residuo, receptora }) => {
        const valor = parte(monto, linea, criterio, suma);
        return [columna, (linea === receptora ? valor.plus(residuo) : valor).toFixed(DECIMALES_ASIGNACION)];
      }),
    ) as Record<ColumnaProrrateada, string>;
    return {
      model_id: linea.model_id,
      cantidad: linea.q,
      tipo_cambio: tc.toFixed(DECIMALES_TIPO_CAMBIO),
      ...asignado,
      armado_pen: totales.costo_armado_unitario_pen.times(linea.q).toFixed(DECIMALES_ASIGNACION),
    };
  });
}

/** Misma expresión que las columnas generadas de `batch_model_costs`, sin redondear. */
function costoTotalExacto(fila: FilaCosteo): Decimal {
  return new Decimal(fila.fob_asignado_usd)
    .plus(fila.flete_internacional_asignado_usd)
    .plus(fila.gastos_agente_asignado_usd)
    .times(fila.tipo_cambio)
    .plus(fila.impuestos_asignados_pen)
    .plus(fila.flete_nacional_asignado_pen)
    .plus(fila.alquiler_asignado_pen)
    .plus(fila.sueldos_asignado_pen)
    .plus(fila.publicidad_asignada_pen)
    .plus(fila.armado_pen);
}

/** Replica `batch_model_costs.costo_total_pen` (numeric(16,4)): para la vista previa y las pruebas. */
export function calcularCostoTotalPen(fila: FilaCosteo): string {
  return costoTotalExacto(fila).toFixed(4);
}

/** Replica `batch_model_costs.costo_landing_unitario_pen`: round(total / cantidad, 2). */
export function calcularCostoUnitarioPen(fila: FilaCosteo): string {
  return costoTotalExacto(fila).div(fila.cantidad).toFixed(2);
}
