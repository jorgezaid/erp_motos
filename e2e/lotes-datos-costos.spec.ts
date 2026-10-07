import { expect, test, type Page } from '@playwright/test';
import { ingresar } from './ayudas';

async function crearLote(page: Page): Promise<string> {
  const codigo = `E2E${Date.now()}`;
  await page.goto('/lotes');
  await page.getByRole('button', { name: 'Nuevo lote' }).click();
  await page.getByRole('dialog').getByLabel('Código de embarque').fill(codigo);
  await page.getByRole('dialog').getByRole('button', { name: 'Crear lote' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`Lote ${codigo}`) })).toBeVisible();
  return codigo;
}

test('M3: pestaña Datos — DAM, fechas y estado, con validación', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe');
  await crearLote(page);

  await page.getByLabel('N.º de DAM').fill('118-2026');
  await page.getByRole('button', { name: 'Guardar datos' }).click();
  await expect(page.getByText('N.º de DAM: formato 118-2026-10-361056-01-0-00.')).toBeVisible();

  const dam = `118-2026-10-${String(Date.now()).slice(-6)}-01-0-00`;
  await page.getByLabel('N.º de DAM').fill(dam);
  await page.getByLabel('Proveedor').fill('Guangzhou EV Co.');
  await page.getByLabel('Fecha de embarque').fill('2026-09-01');
  await page.getByLabel('Fecha de llegada').fill('2026-10-01');
  await page.getByRole('combobox', { name: 'Estado' }).click();
  await page.getByRole('option', { name: 'En aduanas' }).click();
  await page.getByRole('button', { name: 'Guardar datos' }).click();
  await expect(page.getByText('Datos del lote guardados')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('En aduanas');
  await expect(page.getByText(`Guangzhou EV Co. · DAM ${dam}`)).toBeVisible();
  await expect(page.getByLabel('Fecha de llegada')).toHaveValue('2026-10-01');
});

test('M3: pestaña Costos — montos del golden test e interruptor RN-05', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe');
  await crearLote(page);
  await page.getByRole('link', { name: 'Costos' }).click();

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

  // RN-05: con el interruptor activo, todos los tributos van al costo
  await expect(page.getByTestId('impuestos-asignables')).toHaveText('S/ 2 000.00');
  await page.getByRole('switch', { name: /Cargar IGV, IPM y percepción/ }).click();
  await expect(page.getByTestId('impuestos-asignables')).toHaveText('S/ 500.00');
  await page.getByRole('switch', { name: /Cargar IGV, IPM y percepción/ }).click();

  await page.getByLabel('IGV (S/)').fill('10.555');
  await page.getByRole('button', { name: 'Guardar costos' }).click();
  await expect(page.getByText('IGV: número mayor o igual a 0 con hasta 2 decimales.')).toBeVisible();
  await page.getByLabel('IGV (S/)').fill('1000');

  await page.getByRole('button', { name: 'Guardar costos' }).click();
  await expect(page.getByText('Costos del lote guardados')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('FOB total (US$)')).toHaveValue('7200');
  await expect(page.getByLabel('Armado por unidad (S/)')).toHaveValue('60');
  await expect(page.getByTestId('impuestos-asignables')).toHaveText('S/ 2 000.00');
});
