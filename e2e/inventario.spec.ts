import { expect, test } from '@playwright/test';
import { ingresar } from './ayudas';

test('M4: /inventario filtra por estado, modelo, ubicación y color', async ({ page }) => {
  await ingresar(page, 'vendedor@demo.pe', '/inventario');
  await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();

  await page.getByRole('combobox', { name: 'Modelo' }).click();
  await page.getByRole('option', { name: 'DEMO-60' }).click();
  await expect(page.getByText('Mostrando 1–3 de 3')).toBeVisible();
  await expect(page.getByRole('row', { name: /DEMO60-001/ })).toContainText('En caja');

  await page.getByRole('combobox', { name: 'Modelo' }).click();
  await page.getByRole('option', { name: 'Modelo: todos' }).click();
  await page.getByRole('combobox', { name: 'Estado' }).click();
  await page.getByRole('option', { name: 'Vendido' }).click();
  await expect(page.getByRole('row', { name: /DEMO72-001/ })).toBeVisible();
  await expect(page.getByText('Mostrando 1–1 de 1')).toBeVisible();

  await page.getByRole('combobox', { name: 'Estado' }).click();
  await page.getByRole('option', { name: 'Listo en tienda' }).click();
  await page.getByRole('combobox', { name: 'Ubicación' }).click();
  await page.getByRole('option', { name: 'Showroom Piérola' }).click();
  await page.getByRole('combobox', { name: 'Color' }).click();
  await page.getByRole('option', { name: 'Rojo' }).click();
  const filas = page.getByRole('row', { name: /DEMO/ });
  await expect(filas.first()).toContainText('Rojo');
  await expect(filas.first()).toContainText('Showroom Piérola');

  // El vendedor ve los precios, nunca costos
  await expect(page.getByRole('columnheader', { name: 'x1' })).toBeVisible();
  await expect(filas.first()).toContainText('S/ 5 805.89');
  const csv = await (await page.request.get('/inventario/csv?modelo=DEMO-48')).text();
  expect(csv).toContain('Precio x1');
  expect(csv).not.toMatch(/costo/i);
});

test('M4: el técnico ve el inventario sin precios', async ({ page }) => {
  await ingresar(page, 'tecnico@demo.pe', '/inventario');
  await expect(page.getByRole('row', { name: /DEMO48-001/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'x1' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Registrar unidades' })).toBeVisible();
  const csv = await (await page.request.get('/inventario/csv')).text();
  expect(csv).not.toContain('Precio');
});
