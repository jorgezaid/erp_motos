import { describe, expect, it } from 'vitest';
import { esquemaCostosLote, esquemaDatosLote, esquemaLineaPacking } from './lote';

const datos = {
  codigo_embarque: ' 117gzh2606089 ',
  nro_dam: '118-2026-10-361056-01-0-00',
  proveedor: '',
  fecha_embarque: '2026-09-01',
  fecha_llegada: '2026-10-01',
  estado: 'en_aduanas',
  notas: '',
} as const;

describe('esquemaDatosLote (SPEC M3 · Datos)', () => {
  it('normaliza el código de embarque y valida la DAM', () => {
    const r = esquemaDatosLote.parse(datos);
    expect(r.codigo_embarque).toBe('117GZH2606089');
    expect(r.proveedor).toBeNull();
    expect(esquemaDatosLote.safeParse({ ...datos, nro_dam: '118-2026' }).success).toBe(false);
    expect(esquemaDatosLote.safeParse({ ...datos, nro_dam: '' }).success).toBe(true);
  });

  it('la llegada no es anterior al embarque', () => {
    const r = esquemaDatosLote.safeParse({ ...datos, fecha_llegada: '2026-08-01' });
    expect(r.error?.issues[0]?.path).toEqual(['fecha_llegada']);
  });

  it('RN-08: "liquidado" no se elige en Datos (se liquida desde Costeo)', () => {
    expect(esquemaDatosLote.safeParse({ ...datos, estado: 'liquidado' }).success).toBe(false);
  });
});

describe('esquemaCostosLote (SPEC M3 · Costos)', () => {
  const costos = {
    tipo_cambio: '3.78',
    fob_total_usd: '7200',
    flete_internacional_usd: '800',
    gastos_agente_usd: '200',
    ad_valorem_pen: '500',
    igv_pen: '1000',
    ipm_pen: '200',
    percepcion_pen: '300',
    impuestos_recuperables_al_costo: true,
    flete_nacional_pen: '400',
    alquiler_periodo_pen: '1000',
    sueldos_periodo_pen: '2000',
    publicidad_inicial_pen: '200',
    costo_armado_unitario_pen: '60',
  };

  it('acepta el lote del golden test (SPEC §7)', () => {
    expect(esquemaCostosLote.parse(costos).tipo_cambio).toBe('3.78');
  });

  it('el TC puede quedar vacío (se exige al liquidar, RN-07) pero no ser 0 ni tener 5 decimales', () => {
    expect(esquemaCostosLote.parse({ ...costos, tipo_cambio: '' }).tipo_cambio).toBeNull();
    expect(esquemaCostosLote.safeParse({ ...costos, tipo_cambio: '0' }).success).toBe(false);
    expect(esquemaCostosLote.safeParse({ ...costos, tipo_cambio: '3.78123' }).success).toBe(false);
  });

  it('montos ≥ 0 con 2 decimales', () => {
    expect(esquemaCostosLote.safeParse({ ...costos, fob_total_usd: '-1' }).success).toBe(false);
    expect(esquemaCostosLote.safeParse({ ...costos, igv_pen: '10.555' }).success).toBe(false);
  });
});

describe('esquemaLineaPacking (SPEC M3 · Packing list)', () => {
  const linea = {
    model_id: '00000000-0000-4000-a000-000000000001',
    cantidad_packing_list: '6',
    cantidad_dam: '',
    exw_usd_unitario: '300',
    volumen_cbm_unitario: '0.5',
  };

  it('la cantidad de la DAM es opcional', () => {
    expect(esquemaLineaPacking.parse(linea)).toMatchObject({ cantidad_packing_list: 6, cantidad_dam: null });
  });

  it('cantidad > 0 y CBM > 0', () => {
    expect(esquemaLineaPacking.safeParse({ ...linea, cantidad_packing_list: '0' }).success).toBe(false);
    expect(esquemaLineaPacking.safeParse({ ...linea, volumen_cbm_unitario: '0' }).success).toBe(false);
  });
});
