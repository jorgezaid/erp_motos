import { expect, test } from '@playwright/test';
import { ingresar } from './ayudas';

test('M8: conciliación de lotes con alertas en rojo', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe', '/auditoria');
  const conciliacion = page.getByRole('table', { name: 'Conciliación de lotes' });
  const fila = conciliacion.getByRole('row', { name: /DEMO-ALM-002.*DEMO-60/ });
  await expect(fila).toHaveAttribute('data-alerta', 'true');
  await expect(fila).toContainText('Faltan registrar 2 de 5');

  await page.getByRole('combobox', { name: 'Estado' }).click();
  await page.getByRole('option', { name: 'Con alertas' }).click();
  await expect(page).toHaveURL(/estado=alertas/);
  await expect(conciliacion.locator('tbody tr:not([data-alerta])')).toHaveCount(0);

  const csv = await (await page.request.get('/auditoria/csv?vista=conciliacion&estado=alertas')).text();
  expect(csv).toContain('Lote,Modelo,Packing list');
  expect(csv).toContain('DEMO-ALM-002');
});

test('M8: margen real por venta y por modelo, exportable a CSV', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe', '/auditoria?vista=ventas');
  // Venta demo #1: DEMO-72 a S/ 16 287.80 con costo S/ 8 958.29 → 45 %
  const venta = page.getByRole('table', { name: 'Margen por venta' }).getByRole('row', { name: /#1\b/ });
  await expect(venta).toContainText('S/ 16 287.80');
  await expect(venta).toContainText('S/ 8 958.29');
  await expect(venta).toContainText('S/ 7 329.51');
  await expect(venta).toContainText('45 %');

  await page.getByRole('link', { name: 'Margen por modelo' }).click();
  const modelo = page.getByRole('table', { name: 'Margen por modelo' }).getByRole('row', { name: /DEMO-72/ });
  await expect(modelo).toBeVisible();

  // Filtro de fechas (Lima): un rango pasado no tiene ventas
  await page.getByLabel('Desde').fill('2020-01-01');
  await page.getByLabel('Hasta').fill('2020-01-31');
  await expect(page).toHaveURL(/hasta=2020-01-31/);
  await expect(page.getByRole('table', { name: 'Margen por modelo' }).getByRole('row', { name: /DEMO-72/ })).toHaveCount(0);

  const csv = await (await page.request.get('/auditoria/csv?vista=modelos')).text();
  expect(csv).toContain('Modelo,Unidades,Venta (S/),Costo (S/),Utilidad (S/),Margen real');
  expect(csv).toContain('DEMO-72');
});

test('M8: la auditoría (márgenes y costos) es solo para el admin', async ({ page }) => {
  await ingresar(page, 'vendedor@demo.pe');
  await page.goto('/auditoria?vista=ventas');
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  const r = await page.request.get('/auditoria/csv?vista=ventas', { maxRedirects: 0 });
  expect(r.status()).toBe(307);
});
