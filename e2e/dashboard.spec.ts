import { expect, test } from '@playwright/test';
import { ingresar } from './ayudas';

test('M8: el admin ve unidades por estado, ventas del día y del mes, margen y alertas', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe');
  await expect(page.getByTestId('kpi-tienda')).toHaveText(/^\d+$/);
  // La venta demo #1 se confirma al cargar los datos demo (hoy, en Lima)
  await expect(page.getByTestId('kpi-hoy')).toHaveText(/^S\/ [\d ]+\.\d{2}$/);
  await expect(page.getByTestId('kpi-mes')).not.toHaveText('S/ 0.00');
  await expect(page.getByTestId('kpi-margen')).toHaveText(/^\d+(\.\d)? %$/);

  const estados = page.getByRole('list', { name: 'Unidades por estado' });
  await expect(estados.getByRole('listitem')).toHaveCount(5);
  await expect(page.getByTestId('estado-en_caja')).toHaveText(/^\d+$/);

  await expect(page.getByRole('list', { name: 'Alertas de conciliación' })).toContainText('DEMO-ALM-002 · DEMO-60');

  // Cada estado lleva al inventario filtrado
  await estados.getByRole('link', { name: /Vendido/ }).click();
  await expect(page).toHaveURL(/\/inventario\?estado=vendido/);
});

test('M8: el margen y las alertas son solo para el admin; el técnico no ve ventas', async ({ page, browser }) => {
  await ingresar(page, 'vendedor@demo.pe');
  await expect(page.getByTestId('kpi-mes')).toBeVisible();
  await expect(page.getByTestId('kpi-margen')).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Alertas de conciliación' })).toHaveCount(0);

  const tec = await browser.newPage();
  await ingresar(tec, 'tecnico@demo.pe');
  await expect(tec.getByTestId('kpi-tienda')).toBeVisible();
  await expect(tec.getByTestId('kpi-hoy')).toHaveCount(0);
  await expect(tec.getByTestId('kpi-margen')).toHaveCount(0);
  await tec.close();
});
