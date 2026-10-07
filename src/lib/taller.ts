/**
 * Reglas del taller para la UI (SPEC M4). La BD es la autoridad (columna generada `aprobada` y
 * trigger de `vehicle_inventory`); esto solo habilita botones y explica qué falta.
 */

/** RN-11: igual que `technical_inspections.aprobada`. */
export function inspeccionAprobada(i: {
  baterias_contadas: number;
  baterias_esperadas: number;
  vin_verificado: boolean;
  motor_verificado: boolean;
}): boolean {
  return i.baterias_contadas === i.baterias_esperadas && i.vin_verificado && i.motor_verificado;
}

/** Motivos por los que una inspección queda observada (RN-11). */
export function motivosObservada(i: {
  baterias_contadas: number;
  baterias_esperadas: number;
  vin_verificado: boolean;
  motor_verificado: boolean;
}): string[] {
  const m: string[] = [];
  if (i.baterias_contadas !== i.baterias_esperadas) {
    m.push(`Se contaron ${i.baterias_contadas} baterías; el modelo lleva ${i.baterias_esperadas}`);
  }
  if (!i.vin_verificado) m.push('VIN sin verificar');
  if (!i.motor_verificado) m.push('Motor sin verificar');
  return m;
}

/**
 * RN-10: para pasar de en_ensamble a listo_en_tienda hacen falta (a) todos los seriales de batería,
 * (b) la ÚLTIMA inspección aprobada y (c) una ubicación. Devuelve lo que falta (vacío = se puede).
 */
export function requisitosTienda(u: {
  estado: string;
  baterias: number;
  esperadas: number;
  ultimaInspeccionAprobada: boolean | null;
  ubicacion: string | null;
}): string[] {
  const faltan: string[] = [];
  if (u.estado !== 'en_ensamble') faltan.push('La unidad debe estar en ensamble');
  if (u.baterias !== u.esperadas) faltan.push(`Registra los seriales de batería (${u.baterias} de ${u.esperadas})`);
  if (u.ultimaInspeccionAprobada === null) faltan.push('Registra la inspección técnica');
  else if (!u.ultimaInspeccionAprobada) faltan.push('La última inspección está observada: registra una nueva');
  if (!u.ubicacion) faltan.push('Elige la ubicación en tienda');
  return faltan;
}
