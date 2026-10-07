import { expect, test, type Page } from '@playwright/test';
import { ingresar, pestanaLote } from './ayudas';

/** Lote con los datos del golden test (SPEC §7); DEMO-48/72 tienen el EXW y el CBM de TEST-48/72. */
async function crearLoteGolden(page: Page): Promise<string> {
  const codigo = `GOLD${Date.now()}`;
  await page.goto('/lotes');
  await page.getByRole('button', { name: 'Nuevo lote' }).click();
  await page.getByRole('dialog').getByLabel('Código de embarque').fill(codigo);
  await page.getByRole('dialog').getByRole('button', { name: 'Crear lote' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(codigo) })).toBeVisible();

  await pestanaLote(page, 'Costos');
  const montos: [string, string][] = [
    ['Tipo de cambio (S/ por US$)', '3.78'],
    ['FOB total (US$)', '7200'],
    ['Flete internacional (US$)', '800'],
    ['Gastos del agente (US$)', '200'],
    ['Ad Valorem (S/)', '500'],
    ['IGV (S/)', '1000'],
    ['IPM (S/)', '200'],
    ['Percepción (S/)', '300'],
    ['Flete nacional (S/)', '400'],
    ['Alquiler del periodo (S/)', '1000'],
    ['Sueldos del periodo (S/)', '2000'],
    ['Publicidad inicial (S/)', '200'],
  ];
  for (const [etiqueta, valor] of montos) await page.getByLabel(etiqueta).fill(valor);
  await page.getByRole('button', { name: 'Guardar costos' }).click();
  await expect(page.getByText('Costos del lote guardados')).toBeVisible();

  await pestanaLote(page, 'Packing list');
  for (const [modelo, q] of [
    ['DEMO-48', '6'],
    ['DEMO-72', '2'],
  ] as const) {
    await page.getByRole('button', { name: 'Agregar modelo' }).click();
    await page.getByRole('dialog').getByRole('combobox', { name: 'Modelo' }).click();
    await page.getByRole('option', { name: modelo }).click();
    await page.getByRole('dialog').getByLabel('Cantidad (packing list)').fill(q);
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('row', { name: new RegExp(modelo) })).toBeVisible();
  }
  return codigo;
}

test('M3: la pestaña Costeo muestra exactamente los valores de SPEC §7; liquidar congela y reabrir', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe');
  const codigo = await crearLoteGolden(page);
  await pestanaLote(page, 'Costeo');

  // Vista previa = tabla de SPEC §7
  const tabla = page.getByTestId('tabla-costeo');
  await expect(tabla.getByRole('row', { name: /DEMO-48/ })).toContainText(
    ['6', '3 600.0000', '1 000.0000', '342.8571', '85.7143', '171.4286', '750.0000', '1 500.0000', '150.0000', '360.0000'].join(''),
  );
  await expect(tabla.getByRole('row', { name: /DEMO-72/ })).toContainText(
    ['2', '3 600.0000', '1 000.0000', '457.1429', '114.2857', '228.5714', '250.0000', '500.0000', '50.0000', '120.0000'].join(''),
  );
  await expect(page.getByTestId('unitario-DEMO-48')).toHaveText('S/ 3 193.24');
  await expect(page.getByTestId('unitario-DEMO-72')).toHaveText('S/ 8 958.29');
  await expect(page.getByTestId('costo-total-lote')).toHaveText('S/ 37 076.00');
  await expect(page.getByTestId('precio-DEMO-48-unidad_x1')).toContainText('S/ 5 805.89');
  await expect(page.getByTestId('precio-DEMO-48-mayorista_x3')).toContainText('S/ 4 912.68');
  await expect(page.getByTestId('precio-DEMO-48-distribuidor_x6')).toContainText('S/ 4 435.06');

  // RN-07: sin costeo guardado no se liquida
  await expect(page.getByText('Sin guardar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Liquidar lote' })).toBeDisabled();
  await page.getByRole('button', { name: 'Guardar costeo' }).click();
  await expect(page.getByText('Costeo guardado', { exact: true })).toBeVisible();
  await expect(page.getByText('Vigente')).toBeVisible();

  // Liquidar (con confirmación)
  await page.getByRole('button', { name: 'Liquidar lote' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Se congelan los costos');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Liquidar' }).click();
  await expect(page.getByText(`Lote ${codigo} liquidado: precios generados`)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Liquidado');

  // Tras liquidar, los costos quedan deshabilitados y aparece "Reabrir lote"
  await pestanaLote(page, 'Costos');
  await expect(page.getByLabel('FOB total (US$)')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Guardar costos' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reabrir lote' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reabrir' }).click();
  await expect(page.getByText(`Lote ${codigo} reabierto`)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('En almacén');
  await expect(page.getByLabel('FOB total (US$)')).toBeEnabled();
});

test('RN-08: un lote con unidades vendidas no se reabre', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe', '/lotes?q=DEMO-LIQ-001');
  await page.getByRole('link', { name: 'DEMO-LIQ-001' }).click();
  await pestanaLote(page, 'Costeo');
  await page.getByRole('button', { name: 'Reabrir lote' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reabrir' }).click();
  await expect(page.getByText('No se puede reabrir el lote DEMO-LIQ-001: tiene unidades reservadas o vendidas')).toBeVisible();
});
