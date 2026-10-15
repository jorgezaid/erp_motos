/**
 * Validación de la plantilla leída (tarea 11.1, D33): función pura que recibe lo leído del Excel
 * y lo que ya hay en la BD, y devuelve el resumen por hoja, los errores con hoja y fila, y los
 * datos para la RPC `importar_plantilla` (solo si no hay errores).
 *
 * Es validación de experiencia de usuario: la BD vuelve a aplicar todo (CHECK y triggers RN-01,
 * RN-03, RN-04, D23) dentro de la RPC, todo o nada.
 */
import { Decimal } from '@/lib/decimal';
import { normalizarSerial } from '@/lib/registro';
import type { Database } from '@/types/database';
import { HOJAS, type CampoLote, type ErrorImportacion, type PlantillaLeida, type Valor } from './plantilla';

type Enums = Database['public']['Enums'];

export const TIPOS_UBICACION: readonly Enums['location_type'][] = ['almacen', 'showroom', 'taller'];
export const CATEGORIAS: readonly Enums['vehicle_category'][] = ['bicimoto', 'trimoto_pasajeros', 'trimoto_carga'];
export const VOLTAJES = [48, 60, 72] as const;
const ROLES = ['admin', 'tecnico', 'vendedor'];
const MAX_COLOR = 40;
const MAX_TEXTO = 500;

/** Lo que ya hay en la BD y afecta a la importación (lo consulta la Server Action). */
export type EstadoBd = {
  /** Nombres de las ubicaciones existentes */
  ubicaciones: string[];
  modelos: { codigo: string; voltaje: number }[];
  /** Lote con el mismo código de embarque */
  lote: { id: string; codigo: string; estado: Enums['batch_status'] } | null;
  /** Código de otro lote que ya usa el mismo Nro. DAM */
  loteConMismaDam: string | null;
  /** Packing list del lote existente, con las unidades ya registradas por modelo */
  packing: { codigo: string; cantidad: number; registradas: number }[];
  /** Unidades con un VIN o un motor del archivo */
  unidades: { id: string; vin: string; motor: string; loteId: string; codigoModelo: string }[];
  /** Baterías con un serial del archivo o de las unidades existentes del archivo */
  baterias: { serial: string; vehicleId: string; posicion: number | null }[];
};

export type ClavesBusqueda = {
  codigoLote: string | null;
  nroDam: string | null;
  vins: string[];
  motores: string[];
  seriales: string[];
};

export type ResumenHoja = { hoja: string; crear: number; actualizar: number; nota?: string };
export type UsuarioPlantilla = { fila: number; nombre: string; email: string; rol: string; rolValido: boolean };

type Fila = { fila: number };
export type DatosImportacion = {
  ubicaciones: (Fila & { nombre: string; tipo: Enums['location_type']; direccion: string | null })[];
  modelos: (Fila & {
    codigo_modelo: string;
    nombre_comercial: string | null;
    categoria: Enums['vehicle_category'] | null;
    voltaje_sistema: number | null;
    amperaje_bateria_ah: number | null;
    potencia_motor_watts: number | null;
    volumen_cbm_unitario: string | null;
    exw_usd_unitario: string | null;
    garantia_meses: number | null;
    garantia_baterias_meses: number | null;
  })[];
  lote: Record<CampoLote, string | null>;
  packing: (Fila & { codigo_modelo: string; cantidad_packing_list: number; cantidad_dam: number | null; exw_usd_unitario: string | null })[];
  unidades: (Fila & {
    vin_chasis: string;
    nro_motor: string;
    codigo_modelo: string;
    color_primario: string | null;
    color_secundario: string | null;
    notas: string | null;
  })[];
  baterias: (Fila & { vin_chasis: string; serial: string; posicion: number })[];
};

export type Analisis = {
  codigoLote: string | null;
  loteExiste: boolean;
  resumen: ResumenHoja[];
  errores: ErrorImportacion[];
  usuarios: UsuarioPlantilla[];
  /** null si hay errores: no se puede confirmar */
  datos: DatosImportacion | null;
};

// ---------------------------------------------------------------------------- conversiones

const INVALIDO = Symbol('invalido');

function texto(v: Valor): string | null {
  if (v === null) return null;
  if (v instanceof Date) return fechaIso(v);
  const s = String(v).trim();
  return s === '' ? null : s;
}

const codigoModelo = (v: Valor) => texto(v)?.toUpperCase() ?? null;

function serial(v: Valor): string | null {
  const s = texto(v);
  return s === null ? null : normalizarSerial(s) || null;
}

/** Número de una celda: acepta números de Excel y textos como "1,234.50", "1234,5" o "S/ 60". */
function numero(v: Valor): Decimal | null | typeof INVALIDO {
  if (v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? new Decimal(v) : INVALIDO;
  if (typeof v !== 'string') return INVALIDO;
  let s = v.replace(/US\$|S\/|\$/g, '').replace(/\s+/g, '');
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return INVALIDO;
  return new Decimal(s);
}

function fechaIso(d: Date): string {
  // exceljs entrega las fechas de Excel en UTC (la fecha que se ve en la celda)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function fechaValida(a: number, m: number, d: number): string | null {
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  if (a < 1990 || a > 2100) return null;
  return fechaIso(f);
}

/** Fecha de una celda: fecha de Excel, número de serie o texto dd/mm/aaaa (o aaaa-mm-dd). */
function fecha(v: Valor): string | null | typeof INVALIDO {
  if (v === null) return null;
  if (v instanceof Date) return fechaValida(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()) ?? INVALIDO;
  if (typeof v === 'number') {
    if (!Number.isInteger(v) || v < 1) return INVALIDO;
    const f = new Date(Math.round((v - 25569) * 86_400_000));
    return fechaValida(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate()) ?? INVALIDO;
  }
  if (typeof v !== 'string') return INVALIDO;
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v.trim());
  if (m) return fechaValida(Number(m[3]), Number(m[2]), Number(m[1])) ?? INVALIDO;
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v.trim());
  if (m) return fechaValida(Number(m[1]), Number(m[2]), Number(m[3])) ?? INVALIDO;
  return INVALIDO;
}

// ---------------------------------------------------------------------------- validador

class Contexto {
  readonly errores: ErrorImportacion[] = [];

  error(hoja: string, fila: number | null, mensaje: string) {
    this.errores.push({ hoja, fila, mensaje });
  }

  /** Monto o cantidad decimal ≥ 0 (o > 0) redondeado a `decimales`; devuelve string o null. */
  decimal(
    hoja: string,
    fila: number,
    etiqueta: string,
    v: Valor,
    { decimales, maxEnteros, positivo = false }: { decimales: number; maxEnteros: number; positivo?: boolean },
  ): string | null {
    const n = numero(v);
    if (n === null) return null;
    if (n === INVALIDO) {
      this.error(hoja, fila, `${etiqueta}: «${String(v)}» no es un número.`);
      return null;
    }
    if (n.isNegative() && !n.isZero()) {
      this.error(hoja, fila, `${etiqueta}: no puede ser negativo.`);
      return null;
    }
    const r = n.toDecimalPlaces(decimales);
    if (positivo && r.isZero()) {
      this.error(hoja, fila, `${etiqueta}: debe ser mayor que 0.`);
      return null;
    }
    if (r.abs().gte(new Decimal(10).pow(maxEnteros))) {
      this.error(hoja, fila, `${etiqueta}: el número es demasiado grande.`);
      return null;
    }
    return r.toFixed(decimales);
  }

  entero(hoja: string, fila: number, etiqueta: string, v: Valor, minimo: number): number | null {
    const n = numero(v);
    if (n === null) return null;
    if (n === INVALIDO || !n.isInteger()) {
      this.error(hoja, fila, `${etiqueta}: «${String(v)}» no es un número entero.`);
      return null;
    }
    if (n.lt(minimo)) {
      this.error(hoja, fila, minimo === 0 ? `${etiqueta}: no puede ser negativo.` : `${etiqueta}: debe ser al menos ${minimo}.`);
      return null;
    }
    if (n.gt(1_000_000)) {
      this.error(hoja, fila, `${etiqueta}: el número es demasiado grande.`);
      return null;
    }
    return n.toNumber();
  }

  texto(hoja: string, fila: number, etiqueta: string, v: Valor, max = MAX_TEXTO): string | null {
    const s = texto(v);
    if (s !== null && s.length > max) {
      this.error(hoja, fila, `${etiqueta}: máximo ${max} caracteres.`);
      return null;
    }
    return s;
  }
}

/** VIN, motores y seriales del archivo (para consultar la BD antes de validar). */
export function clavesDeBusqueda(p: PlantillaLeida): ClavesBusqueda {
  const vins = new Set<string>();
  const motores = new Set<string>();
  const seriales = new Set<string>();
  for (const u of p.unidades) {
    const vin = serial(u.vin);
    const motor = serial(u.motor);
    if (vin) vins.add(vin);
    if (motor) motores.add(motor);
  }
  for (const b of p.baterias) {
    const vin = serial(b.vin);
    if (vin) vins.add(vin);
    for (const s of [b.s1, b.s2, b.s3, b.s4, b.s5, b.s6]) {
      const x = serial(s);
      if (x) seriales.add(x);
    }
  }
  return {
    codigoLote: texto(p.lote.codigo_embarque?.valor ?? null),
    nroDam: texto(p.lote.nro_dam?.valor ?? null),
    vins: [...vins],
    motores: [...motores],
    seriales: [...seriales],
  };
}

export function validarPlantilla(p: PlantillaLeida, bd: EstadoBd): Analisis {
  const c = new Contexto();
  const resumen: ResumenHoja[] = [];

  // ------------------------------------------------------------------ Ubicaciones
  const H_UBI = HOJAS.ubicaciones;
  const ubicacionesBd = new Set(bd.ubicaciones.map((n) => n.toLowerCase()));
  const nombresUbicacion = new Map<string, number>();
  const ubicaciones: DatosImportacion['ubicaciones'] = [];
  for (const f of p.ubicaciones) {
    const nombre = c.texto(H_UBI, f.fila, 'Nombre', f.nombre, 100);
    const tipo = texto(f.tipo)?.toLowerCase() ?? null;
    if (!nombre) {
      c.error(H_UBI, f.fila, 'Falta el nombre.');
      continue;
    }
    const previa = nombresUbicacion.get(nombre.toLowerCase());
    if (previa) c.error(H_UBI, f.fila, `La ubicación «${nombre}» está repetida (también en la fila ${previa}).`);
    nombresUbicacion.set(nombre.toLowerCase(), f.fila);
    if (!tipo || !TIPOS_UBICACION.includes(tipo as Enums['location_type'])) {
      c.error(H_UBI, f.fila, `Tipo «${texto(f.tipo) ?? ''}»: debe ser almacen, showroom o taller.`);
      continue;
    }
    ubicaciones.push({
      fila: f.fila,
      nombre,
      tipo: tipo as Enums['location_type'],
      direccion: c.texto(H_UBI, f.fila, 'Dirección', f.direccion),
    });
  }
  resumen.push({
    hoja: H_UBI,
    crear: ubicaciones.filter((u) => !ubicacionesBd.has(u.nombre.toLowerCase())).length,
    actualizar: ubicaciones.filter((u) => ubicacionesBd.has(u.nombre.toLowerCase())).length,
  });

  // ------------------------------------------------------------------ Usuarios (solo se listan)
  const usuarios: UsuarioPlantilla[] = p.usuarios.map((u) => {
    const rol = texto(u.rol)?.toLowerCase() ?? '';
    return { fila: u.fila, nombre: texto(u.nombre) ?? '', email: texto(u.email) ?? '', rol, rolValido: ROLES.includes(rol) };
  });
  resumen.push({
    hoja: HOJAS.usuarios,
    crear: 0,
    actualizar: 0,
    nota: usuarios.length > 0 ? `${usuarios.length} usuario(s) para crear a mano en Supabase` : undefined,
  });

  // ------------------------------------------------------------------ Modelos
  const H_MOD = HOJAS.modelos;
  const voltajeBd = new Map(bd.modelos.map((m) => [m.codigo.toUpperCase(), m.voltaje]));
  /** Modelos disponibles para el resto de hojas: código → voltaje (null si es inválido) */
  const voltajeModelo = new Map<string, number | null>(voltajeBd);
  const codigosModelo = new Map<string, number>();
  const modelos: DatosImportacion['modelos'] = [];
  let modelosSinDatos = 0;
  for (const f of p.modelos) {
    const codigo = codigoModelo(f.codigo);
    const sinDatos = [f.nombre, f.categoria, f.voltaje, f.ah, f.watts, f.cbm, f.exw, f.garantia, f.garantiaBaterias].every(
      (v) => v === null,
    );
    if (!codigo) {
      c.error(H_MOD, f.fila, 'Falta el código del modelo.');
      continue;
    }
    // Filas que la plantilla trae solo con el código (XSDU-17, 23…): se ignoran
    if (sinDatos) {
      modelosSinDatos++;
      continue;
    }
    const previa = codigosModelo.get(codigo);
    if (previa) c.error(H_MOD, f.fila, `El modelo ${codigo} está repetido (también en la fila ${previa}).`);
    codigosModelo.set(codigo, f.fila);

    const nuevo = !voltajeBd.has(codigo);
    const errores = c.errores.length;
    const categoria = texto(f.categoria)?.toLowerCase() ?? null;
    if (categoria !== null && !CATEGORIAS.includes(categoria as Enums['vehicle_category'])) {
      c.error(H_MOD, f.fila, `Categoría «${texto(f.categoria)}»: debe ser bicimoto, trimoto_pasajeros o trimoto_carga.`);
    }
    const voltaje = c.entero(H_MOD, f.fila, 'Voltaje (V)', f.voltaje, 1);
    if (voltaje !== null && !(VOLTAJES as readonly number[]).includes(voltaje)) {
      c.error(H_MOD, f.fila, `Voltaje (V): ${voltaje} no es válido; debe ser 48, 60 o 72.`);
    }
    const fila = {
      fila: f.fila,
      codigo_modelo: codigo,
      nombre_comercial: c.texto(H_MOD, f.fila, 'Nombre comercial', f.nombre, 100),
      categoria: categoria as Enums['vehicle_category'] | null,
      voltaje_sistema: voltaje,
      amperaje_bateria_ah: c.entero(H_MOD, f.fila, 'Amperaje batería (Ah)', f.ah, 1),
      potencia_motor_watts: c.entero(H_MOD, f.fila, 'Potencia motor (W)', f.watts, 1),
      volumen_cbm_unitario: c.decimal(H_MOD, f.fila, 'Volumen embalado (CBM)', f.cbm, { decimales: 4, maxEnteros: 6, positivo: true }),
      exw_usd_unitario: c.decimal(H_MOD, f.fila, 'Precio EXW unitario', f.exw, { decimales: 2, maxEnteros: 10 }),
      garantia_meses: c.entero(H_MOD, f.fila, 'Garantía general (meses)', f.garantia, 0),
      garantia_baterias_meses: c.entero(H_MOD, f.fila, 'Garantía baterías (meses)', f.garantiaBaterias, 0),
    };
    if (nuevo && c.errores.length === errores) {
      const faltan = (
        [
          ['Categoría', fila.categoria],
          ['Voltaje (V)', fila.voltaje_sistema],
          ['Amperaje batería (Ah)', fila.amperaje_bateria_ah],
          ['Potencia motor (W)', fila.potencia_motor_watts],
          ['Volumen embalado (CBM)', fila.volumen_cbm_unitario],
          ['Precio EXW unitario', fila.exw_usd_unitario],
        ] as const
      )
        .filter(([, v]) => v === null)
        .map(([e]) => e);
      if (faltan.length > 0) c.error(H_MOD, f.fila, `El modelo ${codigo} es nuevo: falta ${faltan.join(', ')}.`);
    }
    voltajeModelo.set(
      codigo,
      voltaje !== null && (VOLTAJES as readonly number[]).includes(voltaje) ? voltaje : nuevo ? null : (voltajeBd.get(codigo) ?? null),
    );
    modelos.push(fila);
  }
  resumen.push({
    hoja: H_MOD,
    crear: modelos.filter((m) => !voltajeBd.has(m.codigo_modelo)).length,
    actualizar: modelos.filter((m) => voltajeBd.has(m.codigo_modelo)).length,
    nota: modelosSinDatos > 0 ? `${modelosSinDatos} fila(s) solo con el código, sin datos: se ignoran` : undefined,
  });

  /** Error si el modelo no está ni en la hoja Modelos (con datos) ni en el sistema */
  const modeloConocido = (hoja: string, fila: number, codigo: string) => {
    if (voltajeModelo.has(codigo)) return true;
    c.error(hoja, fila, `El modelo ${codigo} no existe: complétalo en la hoja Modelos.`);
    return false;
  };

  // ------------------------------------------------------------------ Lote
  const H_LOTE = HOJAS.lote;
  const l = p.lote;
  const filaLote = (campo: CampoLote) => l[campo].fila;
  const codigoLote = c.texto(H_LOTE, filaLote('codigo_embarque'), 'Código de embarque', l.codigo_embarque.valor, 50);
  if (!codigoLote) c.error(H_LOTE, filaLote('codigo_embarque'), 'Falta el código de embarque: la plantilla importa un lote por archivo.');
  if (bd.lote?.estado === 'liquidado') {
    c.error(H_LOTE, filaLote('codigo_embarque'), `El lote ${bd.lote.codigo} está liquidado: reábrelo en su pestaña Costeo antes de importar.`);
  }
  const nroDam = c.texto(H_LOTE, filaLote('nro_dam'), 'Nro. DAM', l.nro_dam.valor, 50);
  if (nroDam && bd.loteConMismaDam) {
    c.error(H_LOTE, filaLote('nro_dam'), `El Nro. DAM ${nroDam} ya está registrado en el lote ${bd.loteConMismaDam}.`);
  }
  const fechaLote = (campo: 'fecha_embarque' | 'fecha_llegada', etiqueta: string) => {
    const f = fecha(l[campo].valor);
    if (f === INVALIDO) {
      c.error(H_LOTE, filaLote(campo), `${etiqueta}: «${String(l[campo].valor)}» no es una fecha válida (usa dd/mm/aaaa).`);
      return null;
    }
    return f;
  };
  const monto = (campo: CampoLote, etiqueta: string) =>
    c.decimal(H_LOTE, filaLote(campo), etiqueta, l[campo].valor, { decimales: 2, maxEnteros: 12 });
  const lote: DatosImportacion['lote'] = {
    codigo_embarque: codigoLote,
    nro_dam: nroDam,
    proveedor: c.texto(H_LOTE, filaLote('proveedor'), 'Proveedor', l.proveedor.valor, 200),
    fecha_embarque: fechaLote('fecha_embarque', 'Fecha de embarque'),
    fecha_llegada: fechaLote('fecha_llegada', 'Fecha de llegada'),
    tipo_cambio: c.decimal(H_LOTE, filaLote('tipo_cambio'), 'Tipo de cambio', l.tipo_cambio.valor, {
      decimales: 4,
      maxEnteros: 4,
      positivo: true,
    }),
    fob_total_usd: monto('fob_total_usd', 'FOB total'),
    flete_internacional_usd: monto('flete_internacional_usd', 'Flete internacional'),
    gastos_agente_usd: monto('gastos_agente_usd', 'Gastos del agente de carga'),
    ad_valorem_pen: monto('ad_valorem_pen', 'Ad Valorem'),
    igv_pen: monto('igv_pen', 'IGV de importación'),
    ipm_pen: monto('ipm_pen', 'IPM'),
    percepcion_pen: monto('percepcion_pen', 'Percepción'),
    flete_nacional_pen: monto('flete_nacional_pen', 'Flete nacional'),
    alquiler_periodo_pen: monto('alquiler_periodo_pen', 'Alquiler del periodo'),
    sueldos_periodo_pen: monto('sueldos_periodo_pen', 'Sueldos del periodo'),
    publicidad_inicial_pen: monto('publicidad_inicial_pen', 'Publicidad inicial'),
    costo_armado_unitario_pen: c.decimal(H_LOTE, filaLote('costo_armado_unitario_pen'), 'Costo de armado por unidad', l.costo_armado_unitario_pen.valor, {
      decimales: 2,
      maxEnteros: 8,
    }),
  };
  resumen.push({ hoja: H_LOTE, crear: bd.lote ? 0 : 1, actualizar: bd.lote ? 1 : 0, nota: codigoLote ?? undefined });

  // ------------------------------------------------------------------ Packing list
  const H_PL = HOJAS.packing;
  const packingBd = new Map(bd.packing.map((i) => [i.codigo.toUpperCase(), i]));
  /** Cantidad del packing list por modelo: la del archivo o, si no está, la de la BD */
  const cantidadPacking = new Map<string, number>(bd.packing.map((i) => [i.codigo.toUpperCase(), i.cantidad]));
  const modelosPacking = new Map<string, number>();
  const packing: DatosImportacion['packing'] = [];
  for (const f of p.packing) {
    const codigo = codigoModelo(f.codigo);
    if (!codigo) {
      c.error(H_PL, f.fila, 'Falta el código del modelo.');
      continue;
    }
    const previa = modelosPacking.get(codigo);
    if (previa) c.error(H_PL, f.fila, `El modelo ${codigo} está repetido (también en la fila ${previa}).`);
    modelosPacking.set(codigo, f.fila);
    modeloConocido(H_PL, f.fila, codigo);
    const cantidad = c.entero(H_PL, f.fila, 'Cantidad (packing list)', f.cantidad, 1);
    if (cantidad === null && f.cantidad === null) c.error(H_PL, f.fila, 'Falta la cantidad del packing list.');
    const registradas = packingBd.get(codigo)?.registradas ?? 0;
    if (cantidad !== null && cantidad < registradas) {
      c.error(H_PL, f.fila, `${codigo} ya tiene ${registradas} unidad(es) registradas: la cantidad no puede ser menor.`);
    }
    if (cantidad !== null) cantidadPacking.set(codigo, cantidad);
    packing.push({
      fila: f.fila,
      codigo_modelo: codigo,
      cantidad_packing_list: cantidad ?? 0,
      cantidad_dam: c.entero(H_PL, f.fila, 'Cantidad (DAM)', f.cantidadDam, 0),
      exw_usd_unitario: c.decimal(H_PL, f.fila, 'EXW unitario factura', f.exwFactura, { decimales: 2, maxEnteros: 10 }),
    });
  }
  resumen.push({
    hoja: H_PL,
    crear: packing.filter((i) => !packingBd.has(i.codigo_modelo)).length,
    actualizar: packing.filter((i) => packingBd.has(i.codigo_modelo)).length,
  });

  // ------------------------------------------------------------------ Unidades
  const H_UNI = HOJAS.unidades;
  const unidadBdPorVin = new Map(bd.unidades.map((u) => [u.vin, u]));
  const unidadBdPorMotor = new Map(bd.unidades.map((u) => [u.motor, u]));
  const vinsArchivo = new Map<string, number>();
  const motoresArchivo = new Map<string, number>();
  /** Modelo de cada unidad válida del archivo (para la hoja Baterías) */
  const modeloDeVin = new Map<string, string>();
  const nuevasPorModelo = new Map<string, number[]>();
  const unidades: DatosImportacion['unidades'] = [];
  for (const f of p.unidades) {
    const vin = serial(f.vin);
    const motor = serial(f.motor);
    const codigo = codigoModelo(f.codigo);
    const situacion = texto(f.situacion)?.toLowerCase() ?? 'en_caja';
    const errores = c.errores.length;
    if (!vin) c.error(H_UNI, f.fila, 'Falta el VIN.');
    if (!motor) c.error(H_UNI, f.fila, 'Falta el número de motor.');
    if (!codigo) c.error(H_UNI, f.fila, 'Falta el código del modelo.');
    if (situacion !== 'en_caja') {
      c.error(H_UNI, f.fila, `Situación «${texto(f.situacion)}»: no soportado todavía (solo en_caja).`);
    }
    if (vin && vin === motor) c.error(H_UNI, f.fila, 'El VIN y el motor no pueden ser iguales.');
    if (vin) {
      const previa = vinsArchivo.get(vin);
      if (previa) c.error(H_UNI, f.fila, `VIN ${vin} repetido (también en la fila ${previa}).`);
      else vinsArchivo.set(vin, f.fila);
    }
    if (motor) {
      const previa = motoresArchivo.get(motor);
      if (previa) c.error(H_UNI, f.fila, `Motor ${motor} repetido (también en la fila ${previa}).`);
      else motoresArchivo.set(motor, f.fila);
    }
    if (codigo && modeloConocido(H_UNI, f.fila, codigo) && !cantidadPacking.has(codigo)) {
      c.error(H_UNI, f.fila, `El modelo ${codigo} no está en el packing list del lote.`);
    }
    const existente = vin ? unidadBdPorVin.get(vin) : undefined;
    if (existente && (existente.loteId !== bd.lote?.id || existente.codigoModelo.toUpperCase() !== codigo)) {
      c.error(H_UNI, f.fila, `El VIN ${vin} ya está registrado en otro lote o con otro modelo.`);
    }
    const duenoMotor = motor ? unidadBdPorMotor.get(motor) : undefined;
    if (duenoMotor && duenoMotor.vin !== vin) {
      c.error(H_UNI, f.fila, `El motor ${motor} ya está registrado en la unidad ${duenoMotor.vin}.`);
    }
    const fila = {
      fila: f.fila,
      vin_chasis: vin ?? '',
      nro_motor: motor ?? '',
      codigo_modelo: codigo ?? '',
      color_primario: c.texto(H_UNI, f.fila, 'Color primario', f.color1, MAX_COLOR),
      color_secundario: c.texto(H_UNI, f.fila, 'Color secundario', f.color2, MAX_COLOR),
      notas: c.texto(H_UNI, f.fila, 'Notas', f.notas),
    };
    if (c.errores.length > errores || !vin || !codigo) continue;
    modeloDeVin.set(vin, codigo);
    if (!existente) nuevasPorModelo.set(codigo, [...(nuevasPorModelo.get(codigo) ?? []), f.fila]);
    unidades.push(fila);
  }
  // RN-04: registradas + nuevas ≤ packing list, por modelo
  for (const [codigo, filas] of nuevasPorModelo) {
    const declaradas = cantidadPacking.get(codigo) ?? 0;
    const registradas = packingBd.get(codigo)?.registradas ?? 0;
    if (registradas + filas.length > declaradas) {
      c.error(
        H_UNI,
        filas[Math.max(declaradas - registradas, 0)] ?? null,
        `El packing list declara ${declaradas} unidad(es) de ${codigo} y habría ${registradas + filas.length}` +
          (registradas > 0 ? ` (${registradas} ya registradas).` : '.'),
      );
    }
  }
  resumen.push({
    hoja: H_UNI,
    crear: unidades.filter((u) => !unidadBdPorVin.has(u.vin_chasis)).length,
    actualizar: unidades.filter((u) => unidadBdPorVin.has(u.vin_chasis)).length,
    nota: 'Entran en caja',
  });

  // ------------------------------------------------------------------ Baterías
  const H_BAT = HOJAS.baterias;
  const bateriasBdPorSerial = new Map(bd.baterias.map((b) => [b.serial, b]));
  const vinsBaterias = new Map<string, number>();
  const serialesArchivo = new Map<string, number>();
  const baterias: DatosImportacion['baterias'] = [];
  for (const f of p.baterias) {
    const vin = serial(f.vin);
    const seriales = [f.s1, f.s2, f.s3, f.s4, f.s5, f.s6].map(serial);
    if (!vin) {
      c.error(H_BAT, f.fila, 'Falta el VIN.');
      continue;
    }
    const previa = vinsBaterias.get(vin);
    if (previa) c.error(H_BAT, f.fila, `VIN ${vin} repetido (también en la fila ${previa}).`);
    vinsBaterias.set(vin, f.fila);

    const enBd = unidadBdPorVin.get(vin);
    const codigo = modeloDeVin.get(vin) ?? (enBd && enBd.loteId === bd.lote?.id ? enBd.codigoModelo.toUpperCase() : undefined);
    if (!codigo) {
      c.error(H_BAT, f.fila, `La unidad ${vin} no está en la hoja Unidades ni en el lote.`);
      continue;
    }
    const voltaje = voltajeModelo.get(codigo) ?? null;
    const esperadas = voltaje === null ? null : voltaje / 12;
    const yaEnLaUnidad = enBd ? bd.baterias.filter((b) => b.vehicleId === enBd.id) : [];
    const total = new Set(yaEnLaUnidad.map((b) => b.serial));

    seriales.forEach((s, i) => {
      if (!s) return;
      const posicion = i + 1;
      const previaSerial = serialesArchivo.get(s);
      if (previaSerial) {
        c.error(H_BAT, f.fila, `Serial ${s} repetido (también en la fila ${previaSerial}).`);
        return;
      }
      serialesArchivo.set(s, f.fila);
      if (esperadas !== null && posicion > esperadas) {
        c.error(H_BAT, f.fila, `Serial batería ${posicion}: el modelo ${codigo} (${voltaje}V) lleva ${esperadas} baterías de 12V.`);
        return;
      }
      const existente = bateriasBdPorSerial.get(s);
      if (existente && existente.vehicleId !== enBd?.id) {
        c.error(H_BAT, f.fila, `El serial ${s} ya está registrado en otra unidad.`);
        return;
      }
      if (existente) return; // ya registrado en esta unidad: no se toca
      const ocupada = yaEnLaUnidad.find((b) => b.posicion === posicion);
      if (ocupada) {
        c.error(H_BAT, f.fila, `La posición ${posicion} de la unidad ${vin} ya tiene el serial ${ocupada.serial}.`);
        return;
      }
      total.add(s);
      baterias.push({ fila: f.fila, vin_chasis: vin, serial: s, posicion });
    });
    if (esperadas !== null && total.size > esperadas) {
      c.error(H_BAT, f.fila, `La unidad ${vin} lleva ${esperadas} baterías de 12V (${voltaje}V) y tendría ${total.size} seriales.`);
    }
  }
  resumen.push({ hoja: H_BAT, crear: baterias.length, actualizar: 0 });

  const errores = c.errores;
  return {
    codigoLote,
    loteExiste: bd.lote !== null,
    resumen,
    errores,
    usuarios,
    datos: errores.length === 0 ? { ubicaciones, modelos, lote, packing, unidades, baterias } : null,
  };
}
