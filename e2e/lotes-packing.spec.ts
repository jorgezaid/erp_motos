import { expect, test } from '@playwright/test';
import { ingresar } from './ayudas';

test('M3: packing list — EXW y CBM del catálogo, totales y alerta packing vs DAM', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe', '/lotes');
  const codigo = `E2E${Date.now()}`;
  await page.getByRole('button', { name: 'Nuevo lote' }).click();
  await page.getByRole('dialog').getByLabel('Código de embarque').fill(codigo);
  await page.getByRole('dialog').getByRole('button', { name: 'Crear lote' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(codigo) })).toBeVisible();
  await page.getByRole('link', { name: 'Packing list' }).click();
  await expect(page.getByText('El packing list está vacío.')).toBeVisible();

  // DEMO-48: precarga EXW 300 y CBM 0.5 del catálogo
  await page.getByRole('button', { name: 'Agregar modelo' }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByRole('combobox', { name: 'Modelo' }).click();
  await page.getByRole('option', { name: 'DEMO-48' }).click();
  await expect(dialogo.getByLabel('EXW unitario (US$)')).toHaveValue('300');
  await expect(dialogo.getByLabel('CBM unitario')).toHaveValue('0.5');
  await dialogo.getByLabel('Cantidad (packing list)').fill('6');
  await dialogo.getByLabel('Cantidad (DAM)').fill('5');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Modelo agregado al packing list')).toBeVisible();
  await expect(page.getByLabel('Difiere del packing list')).toBeVisible();

  await page.getByRole('button', { name: 'Agregar modelo' }).click();
  await dialogo.getByRole('combobox', { name: 'Modelo' }).click();
  // DEMO-48 ya está en el lote: no se ofrece de nuevo
  await expect(page.getByRole('option', { name: 'DEMO-48' })).toHaveCount(0);
  await page.getByRole('option', { name: 'DEMO-72' }).click();
  await dialogo.getByLabel('Cantidad (packing list)').fill('2');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Modelo agregado al packing list')).toHaveCount(2);

  // Totales del golden test (SPEC §7): 8 unidades, EXW 3 600, CBM 7
  await expect(page.getByTestId('total-unidades')).toHaveText('8');
  await expect(page.getByTestId('total-exw')).toHaveText('US$ 3,600.00');
  await expect(page.getByTestId('total-cbm')).toHaveText('7.0000');

  // Corregir la DAM quita la alerta
  await page.getByRole('button', { name: 'Editar DEMO-48' }).click();
  await dialogo.getByLabel('Cantidad (DAM)').fill('6');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Línea actualizada')).toBeVisible();
  await expect(page.getByLabel('Difiere del packing list')).toHaveCount(0);

  // Quitar una línea
  await page.getByRole('row', { name: /DEMO-72/ }).getByRole('button', { name: 'Quitar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Quitar' }).click();
  await expect(page.getByText('DEMO-72 quitado')).toBeVisible();
  await expect(page.getByTestId('total-unidades')).toHaveText('6');
});

test('D23/RN-04: no se baja la cantidad por debajo de las unidades registradas', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe', '/lotes?q=DEMO-ALM-002');
  await page.getByRole('link', { name: 'DEMO-ALM-002' }).click();
  await page.getByRole('link', { name: 'Packing list' }).click();

  const fila = page.getByRole('row', { name: /DEMO-60/ });
  await expect(fila.getByRole('button', { name: 'Quitar' })).toBeDisabled();
  await fila.getByRole('button', { name: 'Editar DEMO-60' }).click();
  await page.getByRole('dialog').getByLabel('Cantidad (packing list)').fill('2');
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
  await expect(
    page.getByText('El modelo DEMO-60 ya tiene 3 unidad(es) registradas en este lote: la cantidad del packing list no puede ser menor'),
  ).toBeVisible();
});
