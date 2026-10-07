/**
 * Registro masivo de unidades (SPEC M4): interpreta lo pegado desde Excel (columnas VIN, motor,
 * color 1 y color 2, separadas por tabulador, punto y coma o coma) y lo leído con un escáner.
 * RN-03: VIN y motor se normalizan en MAYÚSCULAS y sin espacios (la BD vuelve a normalizarlos y
 * garantiza la unicidad).
 */

export type FilaRegistro = { vin: string; motor: string; color1: string | null; color2: string | null };
export type ErrorRegistro = { linea: number; mensaje: string };

export const MAX_FILAS_REGISTRO = 500;

/** RN-03: mayúsculas y sin espacios. */
export function normalizarSerial(s: string): string {
  return s.replace(/\s+/g, '').toUpperCase();
}

function separar(linea: string): string[] {
  const sep = linea.includes('\t') ? '\t' : linea.includes(';') ? ';' : ',';
  return linea.split(sep).map((c) => c.trim());
}

const ES_ENCABEZADO = /^(vin|chasis|n[°º.]?\s*de\s*chasis)/i;

/** Valida una fila (VIN y motor obligatorios, sin repetirse dentro de lo ingresado). */
export function validarFilas(filas: readonly FilaRegistro[]): ErrorRegistro[] {
  const errores: ErrorRegistro[] = [];
  const vins = new Map<string, number>();
  const motores = new Map<string, number>();
  filas.forEach((f, i) => {
    const linea = i + 1;
    if (!f.vin) errores.push({ linea, mensaje: 'Falta el VIN.' });
    if (!f.motor) errores.push({ linea, mensaje: 'Falta el número de motor.' });
    if (f.vin && f.vin === f.motor) errores.push({ linea, mensaje: 'El VIN y el motor no pueden ser iguales.' });
    if (f.vin) {
      const previa = vins.get(f.vin);
      if (previa) errores.push({ linea, mensaje: `VIN ${f.vin} repetido (también en la fila ${previa}).` });
      else vins.set(f.vin, linea);
    }
    if (f.motor) {
      const previa = motores.get(f.motor);
      if (previa) errores.push({ linea, mensaje: `Motor ${f.motor} repetido (también en la fila ${previa}).` });
      else motores.set(f.motor, linea);
    }
  });
  if (filas.length > MAX_FILAS_REGISTRO) {
    errores.push({ linea: MAX_FILAS_REGISTRO + 1, mensaje: `Máximo ${MAX_FILAS_REGISTRO} unidades por registro.` });
  }
  return errores;
}

/** Lo pegado desde Excel → filas. Ignora líneas vacías y una primera línea de encabezados. */
export function parsearPegado(texto: string): FilaRegistro[] {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lineas[0] && ES_ENCABEZADO.test(lineas[0].trim())) lineas.shift();
  return lineas.map((l) => {
    const [vin = '', motor = '', color1 = '', color2 = ''] = separar(l);
    return {
      vin: normalizarSerial(vin),
      motor: normalizarSerial(motor),
      color1: color1 || null,
      color2: color2 || null,
    };
  });
}

/** "Faltan X de Y" (SPEC M4), a partir de `pendientes_de_registro()`. */
export function textoFaltantes(declaradas: number, registradas: number): string {
  const faltan = Math.max(declaradas - registradas, 0);
  return faltan === 0 ? `Completo: ${registradas} de ${declaradas}` : `Faltan ${faltan} de ${declaradas}`;
}
