/**
 * SOLO PARA PRUEBAS (Vitest y Playwright): genera un archivo de ejemplo a partir de la plantilla
 * v2 real (docs/plantillas/plantilla-datos-reales-erp-v2.xlsx), llenando sus celdas amarillas.
 * No lo importa la app.
 *
 * Contenido: 1 ubicación nueva (más las 3 que ya trae la plantilla), 1 usuario, 2 modelos
 * (XSDU-17 de 48V y XSDU-23 de 60V), el lote `codigoLote`, 2 líneas de packing list (2 + 1),
 * 3 unidades y 4 baterías de la primera unidad.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';

export const RUTA_PLANTILLA_V2 = path.join(process.cwd(), 'docs', 'plantillas', 'plantilla-datos-reales-erp-v2.xlsx');

export type OpcionesEjemplo = {
  codigoLote: string;
  /** Sufijo único para VIN, motores, seriales, DAM y la ubicación nueva */
  sufijo: string;
  /** Cambios sobre el libro ya lleno (para probar errores) */
  modificar?: (wb: ExcelJS.Workbook) => void;
};

export function vinsDeEjemplo(sufijo: string) {
  return [`V${sufijo}A`, `V${sufijo}B`, `V${sufijo}C`] as const;
}

/** Hoja del libro por nombre (falla si no existe). */
export function hoja(wb: ExcelJS.Workbook, nombre: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(nombre);
  if (!ws) throw new Error(`El libro no tiene la hoja «${nombre}»`);
  return ws;
}

function fijar(ws: ExcelJS.Worksheet, fila: number, valores: Record<string, ExcelJS.CellValue>) {
  for (const [col, v] of Object.entries(valores)) ws.getCell(`${col}${fila}`).value = v;
}

export async function libroDeEjemplo({ codigoLote, sufijo, modificar }: OpcionesEjemplo): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await readFile(RUTA_PLANTILLA_V2)) as unknown as ArrayBuffer);

  fijar(hoja(wb, 'Ubicaciones'), 5, { A: `Showroom ${sufijo}`, B: 'showroom', C: 'Av. Prueba 123' });
  fijar(hoja(wb, 'Usuarios'), 3, { A: 'Rosa Quispe', B: 'rosa.quispe@empresa.pe', C: 'tecnico' });

  const modelos = hoja(wb, 'Modelos');
  fijar(modelos, 3, { B: 'Bicimoto 17', C: 'bicimoto', D: 48, F: 20, G: 800, H: 0.45, I: 410, J: 12, K: 6 });
  fijar(modelos, 4, { B: 'Trimoto 23', C: 'trimoto_carga', D: 60, F: 32, G: 1200, H: 1.1, I: 690 });

  const lote = hoja(wb, 'Lote');
  fijar(lote, 2, { B: codigoLote });
  fijar(lote, 3, { B: `DAM-${sufijo}` });
  fijar(lote, 4, { B: 'Proveedor Ejemplo SAC' });
  fijar(lote, 5, { B: new Date(Date.UTC(2026, 8, 1)) });
  // Como la deja Excel al escribir una fecha. Estilo nuevo: exceljs comparte el objeto de estilo
  // entre las celdas cargadas y cambiar `numFmt` en una cambia todas.
  lote.getCell('B5').style = { ...lote.getCell('B5').style, numFmt: 'dd/mm/yyyy' };
  fijar(lote, 6, { B: '15/10/2026' });
  fijar(lote, 8, { B: 1510 });
  fijar(lote, 9, { B: 500 });
  fijar(lote, 10, { B: 120.5 });
  fijar(lote, 12, { B: 1500 });

  const packing = hoja(wb, 'Packing list');
  fijar(packing, 2, { A: 'XSDU-17', B: 2, C: 2 });
  fijar(packing, 3, { A: 'XSDU-23', B: 1, D: 680 });

  const [a, b, c] = vinsDeEjemplo(sufijo);
  const unidades = hoja(wb, 'Unidades');
  fijar(unidades, 3, { A: a, B: `M${sufijo}A`, C: 'XSDU-17', D: 'Rojo', E: 'Negro', F: 'en_caja' });
  fijar(unidades, 4, { A: b, B: `M${sufijo}B`, C: 'XSDU-17', D: 'Azul', F: 'en_caja' });
  fijar(unidades, 5, { A: c, B: `M${sufijo}C`, C: 'XSDU-23', D: 'Blanco', G: 'Caja golpeada' });

  fijar(hoja(wb, 'Baterías (opcional)'), 3, { A: a, B: `B${sufijo}1`, C: `B${sufijo}2`, D: `B${sufijo}3`, E: `B${sufijo}4` });

  modificar?.(wb);
  return wb;
}

/** El archivo de ejemplo como .xlsx. */
export async function plantillaDeEjemplo(opciones: OpcionesEjemplo): Promise<Buffer> {
  const wb = await libroDeEjemplo(opciones);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
