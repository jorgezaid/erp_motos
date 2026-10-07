import { expect, test } from '@playwright/test';
import { ingresar } from './ayudas';

test('M2: CRUD de modelos con baterías derivadas del voltaje', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe', '/admin/modelos/nuevo');

  await page.getByLabel('Código de modelo').fill('e2e-m2');
  await page.getByRole('combobox', { name: 'Voltaje del sistema' }).click();
  // Solo se ofrecen 48V, 60V y 72V (no existe 36V)
  await expect(page.getByRole('option')).toHaveText(['48V', '60V', '72V']);
  await page.getByRole('option', { name: '60V' }).click();
  await expect(page.getByLabel('Baterías (derivadas del voltaje)')).toHaveValue('5 baterías de 12V');

  // Validación en español antes de enviar
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Amperaje (Ah): debe ser un número entero.')).toBeVisible();

  await page.getByLabel('Amperaje de batería (Ah)').fill('20');
  await page.getByLabel('Potencia del motor (W)').fill('800');
  await page.getByLabel('Volumen unitario (CBM)').fill('0.8');
  await page.getByLabel('EXW unitario (US$)').fill('500');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Modelo creado')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/modelos$/);

  const fila = page.getByRole('row', { name: /E2E-M2/ });
  await expect(fila).toContainText('60V · 5 bat.');
  await expect(fila).toContainText('US$ 500.00');

  // Código repetido: mensaje de la BD traducido
  await page.goto('/admin/modelos/nuevo');
  await page.getByLabel('Código de modelo').fill('E2E-M2');
  await page.getByLabel('Amperaje de batería (Ah)').fill('20');
  await page.getByLabel('Potencia del motor (W)').fill('800');
  await page.getByLabel('Volumen unitario (CBM)').fill('0.8');
  await page.getByLabel('EXW unitario (US$)').fill('500');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('El código de modelo ya está registrado.')).toBeVisible();

  // Edición
  await page.goto('/admin/modelos?q=e2e-m2');
  await page.getByRole('link', { name: 'E2E-M2' }).click();
  await page.getByRole('combobox', { name: 'Voltaje del sistema' }).click();
  await page.getByRole('option', { name: '72V' }).click();
  await expect(page.getByLabel('Baterías (derivadas del voltaje)')).toHaveValue('6 baterías de 12V');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Modelo actualizado')).toBeVisible();
  await expect(page.getByRole('row', { name: /E2E-M2/ })).toContainText('72V · 6 bat.');

  // CSV con el filtro aplicado
  const csv = await (await page.request.get('/admin/modelos/csv?q=e2e-m2')).text();
  expect(csv).toContain('E2E-M2');
  expect(csv.trim().split('\r\n')).toHaveLength(2);

  // Eliminación
  await page.getByRole('link', { name: 'E2E-M2' }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.getByText('Modelo E2E-M2 eliminado')).toBeVisible();
  await expect(page.getByRole('row', { name: /E2E-M2/ })).toHaveCount(0);
});
