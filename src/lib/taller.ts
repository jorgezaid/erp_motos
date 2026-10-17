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

/** D37: prefijo reservado a los seriales provisionales de «Listo rápido». */
export const PREFIJO_PROVISIONAL = 'PROV-';

/** D37: serial provisional único de la batería `posicion` de la moto (como `listo_rapido`). */
export function serialProvisional(vin: string, posicion: number): string {
  return `${PREFIJO_PROVISIONAL}${vin.trim().toUpperCase()}-${posicion}`;
}

/** D37: «Baterías sin serial real». */
export function esSerialProvisional(serial: string | null | undefined): boolean {
  return !!serial && serial.trim().toUpperCase().startsWith(PREFIJO_PROVISIONAL);
}

/**
 * D37: posiciones que «Listo rápido» llenará, igual que la RPC: de la 1 a la 6, saltando las
 * ocupadas, hasta completar las baterías que exige el voltaje.
 */
export function posicionesLibres(esperadas: number, ocupadas: readonly (number | null)[]): number[] {
  const usadas = new Set(ocupadas.filter((p): p is number => p !== null));
  const libres: number[] = [];
  for (let p = 1; p <= 6 && ocupadas.length + libres.length < esperadas; p++) {
    if (!usadas.has(p)) libres.push(p);
  }
  return libres;
}

/** D37: ubicación por defecto de «Listo rápido»: Showroom Piérola, o la primera de la lista. */
export function ubicacionPorDefecto(ubicaciones: readonly { id: string; nombre: string }[]): string | null {
  const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return (ubicaciones.find((u) => normalizar(u.nombre) === 'showroom pierola') ?? ubicaciones[0])?.id ?? null;
}
