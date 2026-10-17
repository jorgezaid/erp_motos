/** Alertas de conciliación packing list vs DAM vs seriales (`v_batch_reconciliation`, SPEC M3/M8). */
export type FilaConciliacion = {
  codigo_modelo: string | null;
  cantidad_packing_list: number | null;
  cantidad_dam: number | null;
  unidades_registradas: number | null;
  unidades_baterias_completas: number | null;
  unidades_inspeccion_aprobada: number | null;
  alerta_packing_vs_dam: boolean | null;
  alerta_faltan_registrar: boolean | null;
  alerta_baterias: boolean | null;
  /** D37: motos con baterías de serial provisional (PROV-); no viene de la vista */
  motos_sin_serial_real?: number;
};

export function alertasConciliacion(f: FilaConciliacion): string[] {
  const alertas: string[] = [];
  const pl = f.cantidad_packing_list ?? 0;
  const reg = f.unidades_registradas ?? 0;
  if (f.alerta_packing_vs_dam) alertas.push(`La DAM declara ${f.cantidad_dam} y el packing list ${pl}`);
  if (f.alerta_faltan_registrar) {
    alertas.push(reg < pl ? `Faltan registrar ${pl - reg} de ${pl}` : `Hay ${reg - pl} unidad(es) más que en el packing list`);
  }
  if (f.alerta_baterias) {
    alertas.push(`${reg - (f.unidades_baterias_completas ?? 0)} unidad(es) con baterías incompletas`);
  }
  if (f.motos_sin_serial_real) {
    alertas.push(`${f.motos_sin_serial_real} unidad(es) con baterías sin serial real`);
  }
  return alertas;
}

export function tieneAlertas(f: FilaConciliacion): boolean {
  return !!(f.alerta_packing_vs_dam || f.alerta_faltan_registrar || f.alerta_baterias || f.motos_sin_serial_real);
}
