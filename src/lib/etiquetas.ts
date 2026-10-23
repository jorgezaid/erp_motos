/** Textos en español para los enums de la BD (`public.*`). */
import type { Database } from '@/types/database';

type Enums = Database['public']['Enums'];

export const ESTADO_LOTE: Record<Enums['batch_status'], string> = {
  en_transito: 'En tránsito',
  en_aduanas: 'En aduanas',
  en_almacen: 'En almacén',
  liquidado: 'Liquidado',
};

export const ESTADO_UNIDAD: Record<Enums['vehicle_status'], string> = {
  en_caja: 'En caja',
  en_ensamble: 'En ensamble',
  listo_en_tienda: 'Listo en tienda',
  reservado: 'Reservado',
  vendido: 'Vendido',
};

export const CATEGORIA: Record<Enums['vehicle_category'], string> = {
  bicimoto: 'Bicimoto',
  trimoto_pasajeros: 'Trimoto de pasajeros',
  trimoto_carga: 'Trimoto de carga',
};

export type TipoLote = Enums['tipo_lote'];

/** D41: origen del lote (todos los roles ven solo esto, nunca el proveedor). */
export const TIPO_LOTE: Record<TipoLote, string> = {
  importacion: 'Importación',
  compra_local: 'Compra local',
};

/** D41: tipo de batería del modelo. */
export const TIPO_BATERIA: Record<Enums['tipo_bateria'], string> = {
  plomo_12v: 'Plomo 12V (según el voltaje)',
  litio: 'Litio',
};

export const TIPO_VENTA: Record<Enums['sale_type'], string> = {
  unidad_x1: 'Minorista (x1)',
  mayorista_x3: 'Mayorista (x3)',
  distribuidor_x6: 'Distribuidor (x6)',
};

export const TIPO_VENTA_CORTO: Record<Enums['sale_type'], string> = {
  unidad_x1: 'x1',
  mayorista_x3: 'x3',
  distribuidor_x6: 'x6',
};

export const METODO_PAGO: Record<Enums['payment_method'], string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  mixto: 'Mixto',
};

export const ESTADO_ORDEN: Record<Enums['order_status'], string> = {
  borrador: 'Borrador',
  confirmada: 'Confirmada',
  anulada: 'Anulada',
};

export const TIPO_UBICACION: Record<Enums['location_type'], string> = {
  almacen: 'Almacén',
  showroom: 'Showroom',
  taller: 'Taller',
};

export const COBERTURA: Record<Enums['warranty_coverage'], string> = {
  general: 'General',
  baterias: 'Baterías',
};

export const ESTADO_RECLAMO: Record<Enums['claim_status'], string> = {
  abierto: 'Abierto',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  cerrado: 'Cerrado',
};

export const CATEGORIA_GASTO: Record<Enums['categoria_gasto'], string> = {
  local_infraestructura: 'Local e infraestructura',
  publicidad: 'Publicidad',
  servicios: 'Servicios',
  transporte: 'Transporte',
  sueldos: 'Sueldos',
  alquiler: 'Alquiler',
  otros: 'Otros',
};

export const ESTADO_GASTO: Record<Enums['estado_gasto'], string> = {
  planificado: 'Planificado',
  realizado: 'Realizado',
};

/** Métodos de pago de un gasto: los de las ventas sin "mixto" (CHECK de la tabla gastos). */
export const METODO_PAGO_GASTO: Record<Exclude<Enums['payment_method'], 'mixto'>, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

/** Las claves de un Record de etiquetas, tipadas (para selects y zod). */
export function opciones<K extends string>(etiquetas: Record<K, string>): { valor: K; etiqueta: string }[] {
  return (Object.keys(etiquetas) as K[]).map((valor) => ({ valor, etiqueta: etiquetas[valor] }));
}
