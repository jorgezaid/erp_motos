/**
 * Lectura de la plantilla de datos reales v2 (docs/plantillas/plantilla-datos-reales-erp-v2.xlsx,
 * tarea 11.1, D33). Solo lee: las reglas están en `validar.ts`.
 *
 * Formato EXACTO de la v2: mismas hojas y encabezados, o el archivo se rechaza. Se ignoran las
 * hojas Instrucciones y Preguntas negocio, la fila gris de EJEMPLO (fila 2) y las celdas verdes
 * (Baterías 12V en Modelos, EXW/CBM usados y totales en Packing list, totales en Lote): se
 * recalculan a partir de los datos.
 */
import ExcelJS from 'exceljs';

export type Valor = string | number | boolean | Date | null;

export type ErrorImportacion = { hoja: string; fila: number | null; mensaje: string };

export const HOJAS = {
  ubicaciones: 'Ubicaciones',
  usuarios: 'Usuarios',
  modelos: 'Modelos',
  lote: 'Lote',
  packing: 'Packing list',
  unidades: 'Unidades',
  baterias: 'Baterías (opcional)',
} as const;

/** Columnas que se leen de cada hoja de tabla: letra → [clave, encabezado de la v2]. */
const COLUMNAS = {
  ubicaciones: { A: ['nombre', 'Nombre'], B: ['tipo', 'Tipo'], C: ['direccion', 'Dirección'] },
  usuarios: { A: ['nombre', 'Nombre completo'], B: ['email', 'Email'], C: ['rol', 'Rol'] },
  modelos: {
    A: ['codigo', 'Código modelo'],
    B: ['nombre', 'Nombre comercial'],
    C: ['categoria', 'Categoría'],
    D: ['voltaje', 'Voltaje (V)'],
    F: ['ah', 'Amperaje batería (Ah)'],
    G: ['watts', 'Potencia motor (W)'],
    H: ['cbm', 'Volumen embalado (CBM, m³)'],
    I: ['exw', 'Precio EXW unitario (US$)'],
    J: ['garantia', 'Garantía general (meses)'],
    K: ['garantiaBaterias', 'Garantía baterías (meses)'],
  },
  packing: {
    A: ['codigo', 'Código modelo'],
    B: ['cantidad', 'Cantidad (packing list)'],
    C: ['cantidadDam', 'Cantidad (DAM)'],
    D: ['exwFactura', 'EXW unitario factura (US$) — solo si difiere del catálogo'],
  },
  unidades: {
    A: ['vin', 'VIN / chasis'],
    B: ['motor', 'Nro. de motor'],
    C: ['codigo', 'Código modelo'],
    D: ['color1', 'Color primario'],
    E: ['color2', 'Color secundario'],
    F: ['situacion', 'Situación actual'],
    G: ['notas', 'Notas'],
  },
  baterias: {
    A: ['vin', 'VIN / chasis'],
    B: ['s1', 'Serial batería 1'],
    C: ['s2', 'Serial batería 2'],
    D: ['s3', 'Serial batería 3'],
    E: ['s4', 'Serial batería 4'],
    F: ['s5', 'Serial batería 5 (60V/72V)'],
    G: ['s6', 'Serial batería 6 (solo 72V)'],
  },
} as const satisfies Record<string, Record<string, readonly [string, string]>>;

type Tablas = typeof COLUMNAS;
type ClavesDe<T extends keyof Tablas> = Tablas[T][keyof Tablas[T]] extends readonly [infer K, string] ? K & string : never;
export type FilaLeida<T extends keyof Tablas> = { fila: number } & Record<ClavesDe<T>, Valor>;

/** Hoja Lote: etiqueta de la columna A → campo (el valor está en la columna B). */
export const CAMPOS_LOTE = {
  'Código de embarque': 'codigo_embarque',
  'Nro. DAM': 'nro_dam',
  Proveedor: 'proveedor',
  'Fecha de embarque': 'fecha_embarque',
  'Fecha de llegada': 'fecha_llegada',
  'Tipo de cambio': 'tipo_cambio',
  'FOB total': 'fob_total_usd',
  'Flete internacional': 'flete_internacional_usd',
  'Gastos del agente de carga': 'gastos_agente_usd',
  'Ad Valorem': 'ad_valorem_pen',
  'IGV de importación': 'igv_pen',
  IPM: 'ipm_pen',
  Percepción: 'percepcion_pen',
  'Flete nacional (Callao → destino)': 'flete_nacional_pen',
  'Alquiler del periodo': 'alquiler_periodo_pen',
  'Sueldos del periodo': 'sueldos_periodo_pen',
  'Publicidad inicial': 'publicidad_inicial_pen',
  'Costo de armado por unidad': 'costo_armado_unitario_pen',
} as const;

export type CampoLote = (typeof CAMPOS_LOTE)[keyof typeof CAMPOS_LOTE];

export type PlantillaLeida = {
  ubicaciones: FilaLeida<'ubicaciones'>[];
  usuarios: FilaLeida<'usuarios'>[];
  modelos: FilaLeida<'modelos'>[];
  lote: Record<CampoLote, { fila: number; valor: Valor }>;
  packing: FilaLeida<'packing'>[];
  unidades: FilaLeida<'unidades'>[];
  baterias: FilaLeida<'baterias'>[];
};

/** El archivo no es la plantilla v2 (no es .xlsx, faltan hojas o cambiaron los encabezados). */
export class ErrorPlantilla extends Error {
  constructor(readonly errores: ErrorImportacion[]) {
    super(errores[0]?.mensaje ?? 'El archivo no tiene el formato de la plantilla.');
    this.name = 'ErrorPlantilla';
  }
}

/** Relleno gris de la fila de EJEMPLO en la v2. */
const GRIS_EJEMPLO = 'FFEDEDED';
/** Filas de datos como máximo por hoja (la v2 trae 500 en Unidades). */
export const MAX_FILAS_HOJA = 2000;

export function normalizarValor(v: ExcelJS.CellValue | undefined): Valor {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '#FECHA' : v;
  if (typeof v === 'string') return v.trim() === '' ? null : v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if ('formula' in v || 'sharedFormula' in v) return normalizarValor(v.result as ExcelJS.CellValue);
  if ('richText' in v) return normalizarValor(v.richText.map((t) => t.text).join(''));
  if ('error' in v) return String(v.error);
  if ('text' in v) return normalizarValor(v.text as ExcelJS.CellValue);
  return null;
}

const limpiar = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

function esFilaEjemplo(fila: ExcelJS.Row): boolean {
  const celda = fila.getCell(1);
  const fill = celda.fill;
  return fill?.type === 'pattern' && fill.fgColor?.argb === GRIS_EJEMPLO;
}

function leerTabla<T extends keyof Tablas>(ws: ExcelJS.Worksheet, tabla: T, errores: ErrorImportacion[]): FilaLeida<T>[] {
  const columnas = Object.entries(COLUMNAS[tabla]) as [string, readonly [string, string]][];
  for (const [letra, [, encabezado]] of columnas) {
    const actual = limpiar(normalizarValor(ws.getCell(`${letra}1`).value));
    if (actual !== encabezado) {
      errores.push({
        hoja: ws.name,
        fila: 1,
        mensaje: `La columna ${letra} debería ser «${encabezado}» y es «${actual || '(vacía)'}». Usa la plantilla v2 sin mover columnas.`,
      });
    }
  }

  const filas: FilaLeida<T>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1 || (n === 2 && esFilaEjemplo(row))) return;
    const datos: Record<string, Valor> = {};
    let vacia = true;
    for (const [letra, [clave]] of columnas) {
      const v = normalizarValor(row.getCell(letra).value);
      datos[clave] = v;
      if (v !== null) vacia = false;
    }
    // La fila TOTAL del packing list son fórmulas (celdas calculadas)
    const primera = columnas[0]?.[1][0];
    if (vacia || (primera && limpiar(datos[primera]).toUpperCase() === 'TOTAL')) return;
    filas.push({ fila: n, ...datos } as FilaLeida<T>);
  });
  if (filas.length > MAX_FILAS_HOJA) {
    errores.push({ hoja: ws.name, fila: null, mensaje: `Máximo ${MAX_FILAS_HOJA} filas por hoja.` });
  }
  return filas;
}

function leerLote(ws: ExcelJS.Worksheet, errores: ErrorImportacion[]): PlantillaLeida['lote'] {
  const encontrados = new Map<string, number>();
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    encontrados.set(limpiar(normalizarValor(row.getCell('A').value)), n);
  });
  const lote = {} as PlantillaLeida['lote'];
  for (const [etiqueta, campo] of Object.entries(CAMPOS_LOTE) as [string, CampoLote][]) {
    const fila = encontrados.get(etiqueta);
    if (fila === undefined) {
      errores.push({ hoja: ws.name, fila: null, mensaje: `Falta la fila «${etiqueta}» en la columna A. Usa la plantilla v2.` });
      continue;
    }
    lote[campo] = { fila, valor: normalizarValor(ws.getCell(`B${fila}`).value) };
  }
  return lote;
}

/**
 * Lee el .xlsx. Lanza `ErrorPlantilla` si no es un Excel válido o no tiene el formato de la v2
 * (con todos los problemas de formato encontrados, no solo el primero).
 */
export async function leerPlantilla(contenido: ArrayBuffer): Promise<PlantillaLeida> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(contenido);
  } catch {
    throw new ErrorPlantilla([{ hoja: '—', fila: null, mensaje: 'El archivo no es un Excel .xlsx válido.' }]);
  }

  const errores: ErrorImportacion[] = [];
  const ws = {} as Record<keyof typeof HOJAS, ExcelJS.Worksheet>;
  for (const [clave, nombre] of Object.entries(HOJAS) as [keyof typeof HOJAS, string][]) {
    const hoja = wb.getWorksheet(nombre);
    if (hoja) ws[clave] = hoja;
    else errores.push({ hoja: nombre, fila: null, mensaje: `Falta la hoja «${nombre}». Usa la plantilla v2.` });
  }
  if (errores.length > 0) throw new ErrorPlantilla(errores);

  const plantilla: PlantillaLeida = {
    ubicaciones: leerTabla(ws.ubicaciones, 'ubicaciones', errores),
    usuarios: leerTabla(ws.usuarios, 'usuarios', errores),
    modelos: leerTabla(ws.modelos, 'modelos', errores),
    lote: leerLote(ws.lote, errores),
    packing: leerTabla(ws.packing, 'packing', errores),
    unidades: leerTabla(ws.unidades, 'unidades', errores),
    baterias: leerTabla(ws.baterias, 'baterias', errores),
  };
  if (errores.length > 0) throw new ErrorPlantilla(errores);
  return plantilla;
}
