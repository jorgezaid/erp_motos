import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { hoja, libroDeEjemplo, plantillaDeEjemplo, RUTA_PLANTILLA_V2, vinsDeEjemplo, type OpcionesEjemplo } from './ejemplo';
import { ErrorPlantilla, leerPlantilla, type PlantillaLeida } from './plantilla';
import { clavesDeBusqueda, validarPlantilla, type EstadoBd } from './validar';

const comoArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

const LOTE = 'LOTE-T1';
const S = 'T1';

async function leer(opciones: Partial<OpcionesEjemplo> = {}): Promise<PlantillaLeida> {
  return leerPlantilla(comoArrayBuffer(await plantillaDeEjemplo({ codigoLote: LOTE, sufijo: S, ...opciones })));
}

/** BD recién creada: solo las 3 ubicaciones base (migración datos_base) */
const BD_VACIA: EstadoBd = {
  ubicaciones: ['Almacén Central', 'Showroom Piérola', 'Taller de Ensamble'],
  modelos: [],
  lote: null,
  loteConMismaDam: null,
  packing: [],
  unidades: [],
  baterias: [],
};

const mensajes = (a: ReturnType<typeof validarPlantilla>) => a.errores.map((e) => `${e.hoja}|${e.fila ?? '-'}|${e.mensaje}`);

async function erroresCon(modificar: (wb: ExcelJS.Workbook) => void, bd: EstadoBd = BD_VACIA) {
  return mensajes(validarPlantilla(await leer({ modificar }), bd));
}

describe('leerPlantilla (formato exacto de la v2)', () => {
  it('D33: la plantilla v2 vacía se lee sin la fila de EJEMPLO ni las hojas de instrucciones', async () => {
    const p = await leerPlantilla(comoArrayBuffer(await readFile(RUTA_PLANTILLA_V2)));
    expect(p.usuarios).toEqual([]);
    expect(p.unidades).toEqual([]);
    expect(p.baterias).toEqual([]);
    expect(p.packing).toEqual([]); // las fórmulas verdes y la fila TOTAL no son datos
    expect(p.ubicaciones.map((u) => u.nombre)).toEqual(['Almacén Central', 'Showroom Piérola', 'Taller de Ensamble']);
    expect(p.modelos.map((m) => m.codigo)).toEqual(['XSDU-17', 'XSDU-23', 'XSDU-24', 'XSDU-25', 'XSDU-29', 'XSDU-31', 'XSDU-35', 'XSDU-36']);
    expect(p.lote.codigo_embarque).toEqual({ fila: 2, valor: '117GZH2606089' });
    expect(p.lote.tipo_cambio).toEqual({ fila: 7, valor: 3.78 });
  });

  it('lee el archivo de ejemplo con el número de fila de cada dato', async () => {
    const p = await leer();
    expect(p.unidades.map((u) => [u.fila, u.vin, u.codigo])).toEqual([
      [3, `V${S}A`, 'XSDU-17'],
      [4, `V${S}B`, 'XSDU-17'],
      [5, `V${S}C`, 'XSDU-23'],
    ]);
    expect(p.packing.map((i) => [i.fila, i.codigo, i.cantidad])).toEqual([
      [2, 'XSDU-17', 2],
      [3, 'XSDU-23', 1],
    ]);
    expect(p.lote.fecha_embarque.valor).toBeInstanceOf(Date);
    expect(p.baterias[0]).toMatchObject({ fila: 3, s1: `B${S}1`, s4: `B${S}4`, s5: null });
    // Las columnas verdes no se leen
    expect(Object.keys(p.modelos[0] ?? {})).not.toContain('baterias');
  });

  it('D33: si se borró la fila de EJEMPLO, la fila 2 (sin gris) sí es un dato', async () => {
    const p = await leer({
      modificar: (wb) => {
        const ws = hoja(wb, 'Unidades');
        ws.getRow(2).eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'none' };
        });
      },
    });
    expect(p.unidades.map((u) => u.fila)).toEqual([2, 3, 4, 5]);
  });

  it('rechaza un archivo que no es .xlsx', async () => {
    await expect(leerPlantilla(comoArrayBuffer(Buffer.from('VIN;motor\n1;2')))).rejects.toThrow('no es un Excel .xlsx válido');
  });

  it('rechaza una plantilla sin una hoja o con columnas movidas', async () => {
    const sinHoja = plantillaDeEjemplo({
      codigoLote: LOTE,
      sufijo: S,
      modificar: (wb) => wb.removeWorksheet(hoja(wb, 'Packing list').id),
    });
    await expect(leerPlantilla(comoArrayBuffer(await sinHoja))).rejects.toThrow('Falta la hoja «Packing list»');

    const movida = await plantillaDeEjemplo({
      codigoLote: LOTE,
      sufijo: S,
      modificar: (wb) => {
        hoja(wb, 'Unidades').getCell('C1').value = 'Modelo';
      },
    });
    const error = await leerPlantilla(comoArrayBuffer(movida)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorPlantilla);
    expect((error as ErrorPlantilla).errores).toEqual([
      { hoja: 'Unidades', fila: 1, mensaje: 'La columna C debería ser «Código modelo» y es «Modelo». Usa la plantilla v2 sin mover columnas.' },
    ]);
  });
});

describe('validarPlantilla', () => {
  it('D33: el ejemplo sobre una BD vacía no tiene errores; resumen por hoja y datos para la RPC', async () => {
    const a = validarPlantilla(await leer(), BD_VACIA);
    expect(a.errores).toEqual([]);
    expect(a.codigoLote).toBe(LOTE);
    expect(a.resumen.map((r) => [r.hoja, r.crear, r.actualizar])).toEqual([
      ['Ubicaciones', 1, 3],
      ['Usuarios', 0, 0],
      ['Modelos', 2, 0],
      ['Lote', 1, 0],
      ['Packing list', 2, 0],
      ['Unidades', 3, 0],
      ['Baterías (opcional)', 4, 0],
    ]);
    expect(a.resumen.find((r) => r.hoja === 'Modelos')?.nota).toBe('6 fila(s) solo con el código, sin datos: se ignoran');
    expect(a.usuarios).toEqual([{ fila: 3, nombre: 'Rosa Quispe', email: 'rosa.quispe@empresa.pe', rol: 'tecnico', rolValido: true }]);

    const d = a.datos;
    if (!d) throw new Error('sin errores debe haber datos para la RPC');
    expect(d.lote).toMatchObject({
      codigo_embarque: LOTE,
      nro_dam: `DAM-${S}`,
      fecha_embarque: '2026-09-01',
      fecha_llegada: '2026-10-15',
      tipo_cambio: '3.7800',
      fob_total_usd: '1510.00',
      gastos_agente_usd: '120.50',
      ad_valorem_pen: null, // celda vacía: la RPC conserva el valor o usa el de la BD
      costo_armado_unitario_pen: '60.00',
    });
    expect(d.modelos[0]).toMatchObject({ codigo_modelo: 'XSDU-17', voltaje_sistema: 48, volumen_cbm_unitario: '0.4500', exw_usd_unitario: '410.00' });
    expect(d.packing).toEqual([
      { fila: 2, codigo_modelo: 'XSDU-17', cantidad_packing_list: 2, cantidad_dam: 2, exw_usd_unitario: null },
      { fila: 3, codigo_modelo: 'XSDU-23', cantidad_packing_list: 1, cantidad_dam: null, exw_usd_unitario: '680.00' },
    ]);
    expect(d.unidades.map((u) => u.vin_chasis)).toEqual(vinsDeEjemplo(S));
    expect(d.baterias.map((b) => [b.serial, b.posicion])).toEqual([
      [`B${S}1`, 1],
      [`B${S}2`, 2],
      [`B${S}3`, 3],
      [`B${S}4`, 4],
    ]);
  });

  it('RN-03: VIN y motor se normalizan en mayúsculas y sin espacios', async () => {
    const a = validarPlantilla(
      await leer({ modificar: (wb) => (hoja(wb, 'Unidades').getCell('A3').value = ` v${S.toLowerCase()} a `) }),
      BD_VACIA,
    );
    expect(a.datos?.unidades[0]?.vin_chasis).toBe(`V${S}A`);
  });

  it('RN-03: VIN, motor y serial duplicados en el archivo, con la fila anterior', async () => {
    const errores = await erroresCon((wb) => {
      const u = hoja(wb, 'Unidades');
      u.getCell('A4').value = `V${S}A`;
      u.getCell('B5').value = `M${S}A`;
      hoja(wb, 'Baterías (opcional)').getCell('C3').value = `B${S}1`;
    });
    expect(errores).toEqual(
      expect.arrayContaining([
        `Unidades|4|VIN V${S}A repetido (también en la fila 3).`,
        `Unidades|5|Motor M${S}A repetido (también en la fila 3).`,
        `Baterías (opcional)|3|Serial B${S}1 repetido (también en la fila 3).`,
      ]),
    );
  });

  it('RN-03: VIN de otro lote, motor de otra unidad y serial de otra unidad ya registrados', async () => {
    const bd: EstadoBd = {
      ...BD_VACIA,
      unidades: [
        { id: 'u1', vin: `V${S}A`, motor: 'OTRO', loteId: 'lote-viejo', codigoModelo: 'XSDU-17' },
        { id: 'u2', vin: 'VIN-VIEJO', motor: `M${S}B`, loteId: 'lote-viejo', codigoModelo: 'XSDU-17' },
      ],
      baterias: [{ serial: `B${S}2`, vehicleId: 'u2', posicion: 1 }],
    };
    expect(mensajes(validarPlantilla(await leer(), bd))).toEqual(
      expect.arrayContaining([
        `Unidades|3|El VIN V${S}A ya está registrado en otro lote o con otro modelo.`,
        `Unidades|4|El motor M${S}B ya está registrado en la unidad VIN-VIEJO.`,
      ]),
    );
  });

  it('modelo inexistente en la hoja Modelos y en el sistema', async () => {
    const errores = await erroresCon((wb) => {
      hoja(wb, 'Packing list').getCell('A3').value = 'XSDU-99';
      hoja(wb, 'Unidades').getCell('C5').value = 'XSDU-99';
    });
    expect(errores).toEqual(
      expect.arrayContaining([
        'Packing list|3|El modelo XSDU-99 no existe: complétalo en la hoja Modelos.',
        'Unidades|5|El modelo XSDU-99 no existe: complétalo en la hoja Modelos.',
      ]),
    );
  });

  it('un modelo nuevo exige sus datos; uno que ya existe en el sistema puede venir incompleto', async () => {
    const modificar = (wb: ExcelJS.Workbook) => {
      hoja(wb, 'Modelos').getCell('G4').value = null;
    };
    expect(await erroresCon(modificar)).toEqual(['Modelos|4|El modelo XSDU-23 es nuevo: falta Potencia motor (W).']);
    const bd = { ...BD_VACIA, modelos: [{ codigo: 'XSDU-23', voltaje: 60 }] };
    expect(await erroresCon(modificar, bd)).toEqual([]);
  });

  it('M2: el voltaje debe ser 48, 60 o 72', async () => {
    const errores = await erroresCon((wb) => (hoja(wb, 'Modelos').getCell('D3').value = 36));
    expect(errores).toEqual(['Modelos|3|Voltaje (V): 36 no es válido; debe ser 48, 60 o 72.']);
  });

  it('RN-04: más unidades de un modelo que su packing list', async () => {
    const errores = await erroresCon((wb) => (hoja(wb, 'Packing list').getCell('B2').value = 1));
    expect(errores).toEqual(['Unidades|4|El packing list declara 1 unidad(es) de XSDU-17 y habría 2.']);
  });

  it('RN-04: cuenta también las unidades ya registradas en el lote', async () => {
    const bd: EstadoBd = {
      ...BD_VACIA,
      modelos: [{ codigo: 'XSDU-17', voltaje: 48 }],
      lote: { id: 'L1', codigo: LOTE, estado: 'en_almacen' },
      packing: [{ codigo: 'XSDU-17', cantidad: 3, registradas: 1 }],
    };
    const errores = await erroresCon((wb) => (hoja(wb, 'Packing list').getCell('B2').value = 2), bd);
    expect(errores).toEqual(['Unidades|4|El packing list declara 2 unidad(es) de XSDU-17 y habría 3 (1 ya registradas).']);
  });

  it('D23: la cantidad del packing list no baja de las unidades ya registradas', async () => {
    const bd: EstadoBd = {
      ...BD_VACIA,
      lote: { id: 'L1', codigo: LOTE, estado: 'en_almacen' },
      packing: [{ codigo: 'XSDU-23', cantidad: 3, registradas: 3 }],
    };
    const errores = await erroresCon(() => {}, bd);
    expect(errores).toContain('Packing list|3|XSDU-23 ya tiene 3 unidad(es) registradas: la cantidad no puede ser menor.');
  });

  it('montos negativos, textos que no son números y fechas inválidas en la hoja Lote', async () => {
    const errores = await erroresCon((wb) => {
      const l = hoja(wb, 'Lote');
      l.getCell('B9').value = -500;
      l.getCell('B12').value = 'mil';
      l.getCell('B6').value = '31/02/2026';
      l.getCell('B7').value = 0;
    });
    expect(errores).toEqual([
      'Lote|6|Fecha de llegada: «31/02/2026» no es una fecha válida (usa dd/mm/aaaa).',
      'Lote|7|Tipo de cambio: debe ser mayor que 0.',
      'Lote|9|Flete internacional: no puede ser negativo.',
      'Lote|12|IGV de importación: «mil» no es un número.',
    ]);
  });

  it('acepta montos escritos como texto ("1,234.50", "S/ 60") y fechas dd/mm/aaaa', async () => {
    const a = validarPlantilla(
      await leer({
        modificar: (wb) => {
          const l = hoja(wb, 'Lote');
          l.getCell('B8').value = '1,234.50';
          l.getCell('B19').value = 'S/ 65';
          l.getCell('B5').value = '01/09/2026';
          l.getCell('B6').value = 46310; // número de serie de Excel (celda sin formato de fecha)
        },
      }),
      BD_VACIA,
    );
    expect(a.errores).toEqual([]);
    expect(a.datos?.lote).toMatchObject({
      fob_total_usd: '1234.50',
      costo_armado_unitario_pen: '65.00',
      fecha_embarque: '2026-09-01',
      fecha_llegada: '2026-10-15',
    });
  });

  it('RN-07: un lote liquidado no se importa', async () => {
    const bd: EstadoBd = { ...BD_VACIA, lote: { id: 'L1', codigo: LOTE, estado: 'liquidado' } };
    expect(await erroresCon(() => {}, bd)).toEqual([
      `Lote|2|El lote ${LOTE} está liquidado: reábrelo en su pestaña Costeo antes de importar.`,
    ]);
  });

  it('un lote por archivo: el código de embarque es obligatorio; la DAM no se repite en otro lote', async () => {
    expect(await erroresCon((wb) => (hoja(wb, 'Lote').getCell('B2').value = null))).toEqual([
      'Lote|2|Falta el código de embarque: la plantilla importa un lote por archivo.',
    ]);
    expect(await erroresCon(() => {}, { ...BD_VACIA, loteConMismaDam: 'LOTE-VIEJO' })).toEqual([
      `Lote|3|El Nro. DAM DAM-${S} ya está registrado en el lote LOTE-VIEJO.`,
    ]);
  });

  it('RN-01: no más baterías que voltaje/12', async () => {
    const errores = await erroresCon((wb) => (hoja(wb, 'Baterías (opcional)').getCell('F3').value = `B${S}5`));
    expect(errores).toEqual(['Baterías (opcional)|3|Serial batería 5: el modelo XSDU-17 (48V) lleva 4 baterías de 12V.']);
  });

  it('RN-01: cuenta las baterías ya registradas en la unidad', async () => {
    const bd: EstadoBd = {
      ...BD_VACIA,
      modelos: [{ codigo: 'XSDU-17', voltaje: 48 }],
      lote: { id: 'L1', codigo: LOTE, estado: 'en_almacen' },
      packing: [{ codigo: 'XSDU-17', cantidad: 2, registradas: 1 }],
      unidades: [{ id: 'u1', vin: `V${S}A`, motor: `M${S}A`, loteId: 'L1', codigoModelo: 'XSDU-17' }],
      baterias: [{ serial: 'VIEJA-1', vehicleId: 'u1', posicion: 1 }],
    };
    expect(await erroresCon(() => {}, bd)).toEqual([`Baterías (opcional)|3|La posición 1 de la unidad V${S}A ya tiene el serial VIEJA-1.`]);
    // Sin posición registrada: 1 en la BD + 4 del archivo > 4
    const sinPosicion = { ...bd, baterias: [{ serial: 'VIEJA-1', vehicleId: 'u1', posicion: null }] };
    expect(await erroresCon(() => {}, sinPosicion)).toEqual([
      `Baterías (opcional)|3|La unidad V${S}A lleva 4 baterías de 12V (48V) y tendría 5 seriales.`,
    ]);
  });

  it('baterías de una unidad que no está en la hoja Unidades ni en el lote', async () => {
    const errores = await erroresCon((wb) => (hoja(wb, 'Baterías (opcional)').getCell('A3').value = 'VIN-NADA'));
    expect(errores).toEqual(['Baterías (opcional)|3|La unidad VIN-NADA no está en la hoja Unidades ni en el lote.']);
  });

  it('D33: una Situación distinta de en_caja no está soportada todavía', async () => {
    const errores = await erroresCon((wb) => (hoja(wb, 'Unidades').getCell('F4').value = 'vendida'));
    expect(errores).toEqual(['Unidades|4|Situación «vendida»: no soportado todavía (solo en_caja).']);
  });

  it('D33: reimportar el mismo archivo: lo existente se actualiza y no cuenta dos veces para RN-04', async () => {
    const bd: EstadoBd = {
      ubicaciones: [...BD_VACIA.ubicaciones, `Showroom ${S}`],
      modelos: [
        { codigo: 'XSDU-17', voltaje: 48 },
        { codigo: 'XSDU-23', voltaje: 60 },
      ],
      lote: { id: 'L1', codigo: LOTE, estado: 'en_almacen' },
      loteConMismaDam: null,
      packing: [
        { codigo: 'XSDU-17', cantidad: 2, registradas: 2 },
        { codigo: 'XSDU-23', cantidad: 1, registradas: 1 },
      ],
      unidades: [
        { id: 'u1', vin: `V${S}A`, motor: `M${S}A`, loteId: 'L1', codigoModelo: 'XSDU-17' },
        { id: 'u2', vin: `V${S}B`, motor: `M${S}B`, loteId: 'L1', codigoModelo: 'XSDU-17' },
        { id: 'u3', vin: `V${S}C`, motor: `M${S}C`, loteId: 'L1', codigoModelo: 'XSDU-23' },
      ],
      baterias: [1, 2, 3, 4].map((n) => ({ serial: `B${S}${n}`, vehicleId: 'u1', posicion: n })),
    };
    const a = validarPlantilla(await leer(), bd);
    expect(a.errores).toEqual([]);
    expect(a.resumen.map((r) => [r.hoja, r.crear, r.actualizar])).toEqual([
      ['Ubicaciones', 0, 4],
      ['Usuarios', 0, 0],
      ['Modelos', 0, 2],
      ['Lote', 0, 1],
      ['Packing list', 0, 2],
      ['Unidades', 0, 3],
      ['Baterías (opcional)', 0, 0],
    ]);
  });

  it('clavesDeBusqueda: VIN, motores y seriales normalizados para consultar la BD', async () => {
    const claves = clavesDeBusqueda(await leer());
    expect(claves).toEqual({
      codigoLote: LOTE,
      nroDam: `DAM-${S}`,
      vins: vinsDeEjemplo(S),
      motores: [`M${S}A`, `M${S}B`, `M${S}C`],
      seriales: [1, 2, 3, 4].map((n) => `B${S}${n}`),
    });
  });

  it('libroDeEjemplo parte de la plantilla v2 real', async () => {
    const wb = await libroDeEjemplo({ codigoLote: LOTE, sufijo: S });
    expect(wb.worksheets.map((w) => w.name)).toContain('Preguntas negocio');
  });
});
