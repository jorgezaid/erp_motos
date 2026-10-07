/**
 * Replica las columnas generadas de `import_batches` para la vista previa de la pestaña Costos
 * (RN-05). La BD calcula los valores reales; aquí solo se muestran mientras se edita.
 */
import { Decimal } from '@/lib/decimal';
import type { Valor } from './prorrateo';

function d(v: Valor | null | undefined): Decimal {
  try {
    const x = new Decimal(v === null || v === undefined || v === '' ? 0 : v);
    return x.isFinite() ? x : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

export type ImpuestosLote = {
  ad_valorem_pen: Valor;
  igv_pen: Valor;
  ipm_pen: Valor;
  percepcion_pen: Valor;
  impuestos_recuperables_al_costo: boolean;
};

/** `impuestos_sunat_pen` = Ad Valorem + IGV + IPM + percepción. */
export function impuestosSunat(l: ImpuestosLote): string {
  return d(l.ad_valorem_pen).plus(d(l.igv_pen)).plus(d(l.ipm_pen)).plus(d(l.percepcion_pen)).toFixed(2);
}

/**
 * RN-05: `impuestos_asignables_pen` = Ad Valorem + (IGV + IPM + percepción solo si
 * `impuestos_recuperables_al_costo`).
 */
export function impuestosAsignables(l: ImpuestosLote): string {
  const resto = l.impuestos_recuperables_al_costo ? d(l.igv_pen).plus(d(l.ipm_pen)).plus(d(l.percepcion_pen)) : 0;
  return d(l.ad_valorem_pen).plus(resto).toFixed(2);
}
