import { expect, test } from '@playwright/test';
import { ingresar } from './ayudas';

test('M3: el admin crea un lote y lo encuentra en el listado', async ({ page }) => {
  const codigo = `E2E${Date.now()}`;
  await ingresar(page, 'admin@demo.pe', '/lotes');
  await page.getByRole('button', { name: 'Nuevo lote' }).click();
  await page.getByRole('dialog').getByLabel('Código de embarque').fill(codigo.toLowerCase());
  await page.getByRole('dialog').getByLabel('Proveedor').fill('Proveedor E2E');
  await page.getByRole('dialog').getByRole('button', { name: 'Crear lote' }).click();

  await expect(page.getByRole('heading', { name: new RegExp(`Lote ${codigo}`) })).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(`Lote ${codigo}`) })).toContainText('En tránsito');

  await page.goto(`/lotes?q=${codigo}`);
  const fila = page.getByRole('row', { name: new RegExp(codigo) });
  await expect(fila).toContainText('Proveedor E2E');
  await expect(fila).toContainText('En tránsito');

  await page.getByRole('combobox', { name: 'Estado' }).click();
  await page.getByRole('option', { name: 'Liquidado' }).click();
  await expect(page.getByRole('row', { name: new RegExp(codigo) })).toHaveCount(0);
});

test('M3: los lotes (costos) son solo para el admin', async ({ page }) => {
  await ingresar(page, 'vendedor@demo.pe');
  await page.goto('/lotes');
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  const r = await page.request.get('/lotes/csv', { maxRedirects: 0 });
  expect(r.status()).toBe(307);
});
