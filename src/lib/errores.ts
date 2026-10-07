/**
 * Resultado de las Server Actions y traducción de errores de Supabase a mensajes para el usuario.
 *
 * Los mensajes de los triggers (RAISE EXCEPTION, código P0001) ya están en español y se muestran
 * TAL CUAL (CLAUDE.md regla 3). Solo se traducen los errores genéricos de Postgres/PostgREST
 * (RLS, únicos, checks), que llegan en inglés.
 */
export type Resultado<T = null> =
  | { ok: true; datos: T }
  | { ok: false; error: string; campos?: Record<string, string> };

export function exito<T>(datos: T): Resultado<T> {
  return { ok: true, datos };
}

export function fallo(error: string, campos?: Record<string, string>): { ok: false; error: string; campos?: Record<string, string> } {
  return campos ? { ok: false, error, campos } : { ok: false, error };
}

/** Lo que traen PostgrestError y AuthError. */
export type ErrorSupabase = { message: string; code?: string | null; details?: string | null };

const CAMPOS_UNICOS: Record<string, string> = {
  vin_chasis: 'El VIN',
  nro_motor: 'El número de motor',
  serial: 'El serial de batería',
  codigo_modelo: 'El código de modelo',
  codigo_embarque: 'El código de embarque',
  nro_dam: 'El número de DAM',
  nombre: 'El nombre',
};

const CHECKS: Record<string, string> = {
  documento_valido:
    'Documento inválido: el DNI tiene 8 dígitos; el RUC, 11 dígitos y empieza por 10, 15, 17 o 20; el CE, de 8 a 12 letras o números.',
  anulacion_con_motivo: 'Para anular la orden indica el motivo.',
  vehicle_models_voltaje_sistema_check: 'El voltaje debe ser 48V, 60V o 72V.',
};

export function mensajeDeError(error: ErrorSupabase | null | undefined): string {
  if (!error) return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  const { code, message, details } = error;

  // Triggers y RPC del proyecto: mensaje en español para el usuario final
  if (code === 'P0001' || code === 'P0002') return message;

  if (code === '42501') {
    // Los triggers de permisos (p. ej. "Solo un administrador…") también usan 42501
    if (/^[A-ZÁÉÍÓÚÑ¿¡]/.test(message) && !/row-level security|permission denied/i.test(message)) return message;
    return 'No tienes permiso para realizar esta acción.';
  }
  if (code === '23505') {
    const m = /Key \(([^)]+)\)=\(([^)]*)\)/.exec(details ?? message);
    const campo = m?.[1] ? CAMPOS_UNICOS[m[1]] : undefined;
    if (campo && m?.[2] !== undefined) return `${campo} "${m[2]}" ya está registrado.`;
    return 'Ya existe un registro con esos datos.';
  }
  if (code === '23514') {
    const m = /constraint "([^"]+)"/.exec(message);
    return (m?.[1] && CHECKS[m[1]]) || 'Algún dato no cumple las reglas de validación.';
  }
  if (code === '23503') return 'El registro está relacionado con otros datos y no se puede modificar ni eliminar.';
  if (code === '23502') return 'Falta completar un campo obligatorio.';
  if (code === '22P02' || code === '22003') return 'Algún valor numérico o identificador no tiene un formato válido.';

  // Supabase Auth
  if (/invalid login credentials/i.test(message)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(message)) return 'Debes confirmar tu email antes de ingresar.';

  // Mensajes ya en español (otros errores lanzados por la BD sin código conocido)
  if (/[áéíóúñ¿¡]/i.test(message)) return message;
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

/**
 * RLS filtra en silencio: un UPDATE/DELETE sin permiso devuelve 0 filas, no un error
 * (CLAUDE.md regla 6). Usar con `.select()` tras la mutación.
 */
export function sinFilasAfectadas(filas: unknown[] | null | undefined): boolean {
  return !filas || filas.length === 0;
}

export const MENSAJE_SIN_FILAS =
  'No se aplicó ningún cambio: el registro no existe o no tienes permiso para modificarlo.';
