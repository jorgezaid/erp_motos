import { describe, expect, it } from 'vitest';
import { bateriasPorVoltaje, esquemaModelo, MODELO_VACIO, textoBaterias, textoBateriasModelo } from './modelo';

const valido = {
  ...MODELO_VACIO,
  codigo_modelo: ' xsdu-29 ',
  voltaje_sistema: '60',
  amperaje_bateria_ah: '20',
  potencia_motor_watts: '800',
  volumen_cbm_unitario: '0,8',
  exw_usd_unitario: '500',
};

describe('RN-01: baterías derivadas del voltaje', () => {
  it('48V → 4, 60V → 5, 72V → 6', () => {
    expect(bateriasPorVoltaje(48)).toBe(4);
    expect(bateriasPorVoltaje(60)).toBe(5);
    expect(bateriasPorVoltaje(72)).toBe(6);
    expect(bateriasPorVoltaje(36)).toBeNull();
  });

  it('M2: al elegir 60V se muestra "5 baterías de 12V"', () => {
    expect(textoBaterias(60)).toBe('5 baterías de 12V');
  });
});

describe('esquemaModelo (SPEC M2)', () => {
  it('normaliza el código a mayúsculas y la coma decimal', () => {
    const r = esquemaModelo.parse(valido);
    expect(r.codigo_modelo).toBe('XSDU-29');
    expect(r.voltaje_sistema).toBe(60);
    expect(r.volumen_cbm_unitario).toBe('0.8');
    expect(r.nombre_comercial).toBeNull();
  });

  it('M2: no se puede crear un modelo de 36V', () => {
    const r = esquemaModelo.safeParse({ ...valido, voltaje_sistema: '36' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('El voltaje debe ser 48V, 60V o 72V.');
  });

  it('el CBM debe ser > 0 con hasta 4 decimales; el EXW ≥ 0 con 2', () => {
    expect(esquemaModelo.safeParse({ ...valido, volumen_cbm_unitario: '0' }).success).toBe(false);
    expect(esquemaModelo.safeParse({ ...valido, volumen_cbm_unitario: '0.12345' }).success).toBe(false);
    expect(esquemaModelo.safeParse({ ...valido, exw_usd_unitario: '0' }).success).toBe(true);
    expect(esquemaModelo.safeParse({ ...valido, exw_usd_unitario: '10.001' }).success).toBe(false);
    expect(esquemaModelo.safeParse({ ...valido, exw_usd_unitario: '-1' }).success).toBe(false);
  });

  it('amperaje y potencia: enteros positivos', () => {
    expect(esquemaModelo.safeParse({ ...valido, amperaje_bateria_ah: '0' }).success).toBe(false);
    expect(esquemaModelo.safeParse({ ...valido, potencia_motor_watts: '12.5' }).success).toBe(false);
  });

  it('D41: EXW y CBM opcionales (compras locales)', () => {
    const r = esquemaModelo.parse({ ...valido, volumen_cbm_unitario: '', exw_usd_unitario: '' });
    expect(r.volumen_cbm_unitario).toBeNull();
    expect(r.exw_usd_unitario).toBeNull();
  });

  it('D41: litio exige su cantidad (1 a 6); plomo la ignora', () => {
    expect(esquemaModelo.parse({ ...valido, tipo_bateria: 'litio', baterias_litio: '1', tiene_techo: true })).toMatchObject({
      tipo_bateria: 'litio',
      baterias_litio: 1,
      tiene_techo: true,
    });
    expect(esquemaModelo.safeParse({ ...valido, tipo_bateria: 'litio', baterias_litio: '' }).success).toBe(false);
    expect(esquemaModelo.safeParse({ ...valido, tipo_bateria: 'litio', baterias_litio: '7' }).success).toBe(false);
    expect(esquemaModelo.parse({ ...valido, tipo_bateria: 'plomo_12v', baterias_litio: '3' }).baterias_litio).toBeNull();
  });

  it('D41: vista previa de las baterías según el tipo', () => {
    expect(textoBateriasModelo(60, 'plomo_12v', '')).toBe('5 baterías de 12V');
    expect(textoBateriasModelo(60, 'litio', '1')).toBe('1 batería de litio');
    expect(textoBateriasModelo(60, 'litio', '')).toBe('Indica de 1 a 6 baterías de litio');
  });
});
