'use client';

import { toast } from 'sonner';
import type { Resultado } from '@/lib/errores';

/**
 * Muestra el resultado de una Server Action en un toast (SPEC §11): los errores de la BD
 * llegan ya traducidos por `mensajeDeError` y se muestran tal cual. Devuelve si tuvo éxito.
 */
export function avisar<T>(resultado: Resultado<T>, mensajeExito?: string): resultado is { ok: true; datos: T } {
  if (resultado.ok) {
    if (mensajeExito) toast.success(mensajeExito);
    return true;
  }
  toast.error(resultado.error);
  return false;
}
