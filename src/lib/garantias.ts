/** Garantías y reclamos (SPEC M7). La BD valida RN-19 y las transiciones (D27); esto guía la UI. */

export type EstadoReclamo = 'abierto' | 'en_revision' | 'aprobado' | 'rechazado' | 'cerrado';

/** abierto → en_revision → aprobado | rechazado → cerrado */
export function siguientesEstados(estado: EstadoReclamo): EstadoReclamo[] {
  switch (estado) {
    case 'abierto':
      return ['en_revision'];
    case 'en_revision':
      return ['aprobado', 'rechazado'];
    case 'aprobado':
    case 'rechazado':
      return ['cerrado'];
    case 'cerrado':
      return [];
  }
}

export const ACCION_ESTADO: Record<EstadoReclamo, string> = {
  abierto: 'Reabrir',
  en_revision: 'Pasar a revisión',
  aprobado: 'Aprobar',
  rechazado: 'Rechazar',
  cerrado: 'Cerrar',
};

/** Estado de la cobertura para mostrar: vigente con días restantes, vencida o anulada. */
export function textoVigencia(g: { vigente: boolean | null; anulada: boolean | null; dias_restantes: number | null }): string {
  if (g.anulada) return 'Anulada';
  if (!g.vigente) return 'Vencida';
  const d = g.dias_restantes ?? 0;
  return d === 1 ? 'Vigente · 1 día restante' : `Vigente · ${d} días restantes`;
}
