import { expect, test } from '@playwright/test';
import { ingresar } from './ayudas';

test('M1: el admin asigna un rol y el usuario pendiente entra al sistema', async ({ page, browser }) => {
  await ingresar(page, 'admin@demo.pe', '/admin/usuarios');
  await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible();

  // Filtro por estado "Sin rol"
  await page.getByRole('combobox', { name: 'Estado' }).click();
  await page.getByRole('option', { name: 'Sin rol (pendiente)' }).click();
  await expect(page.getByRole('cell', { name: 'pendiente@demo.pe', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'vendedor@demo.pe', exact: true })).toHaveCount(0);

  await page.getByRole('combobox', { name: 'Rol de pendiente@demo.pe' }).click();
  await page.getByRole('option', { name: 'Vendedor' }).click();
  await expect(page.getByText('Rol de pendiente@demo.pe actualizado')).toBeVisible();

  // El admin no puede cambiar su propio rol desde la UI
  await page.goto('/admin/usuarios');
  await expect(page.getByRole('combobox', { name: 'Rol de admin@demo.pe' })).toBeDisabled();

  const otro = await browser.newPage();
  await ingresar(otro, 'pendiente@demo.pe');
  await expect(otro).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  await expect(otro.getByText('Rol: Vendedor')).toBeVisible();
  await otro.close();

  // Deja el usuario como estaba
  await page.getByRole('combobox', { name: 'Rol de pendiente@demo.pe' }).click();
  await page.getByRole('option', { name: 'Sin rol' }).click();
  await expect(page.getByText('Rol de pendiente@demo.pe actualizado')).toBeVisible();
});

test('M1: el CSV de usuarios se descarga con encabezados en español', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe');
  const r = await page.request.get('/admin/usuarios/csv');
  expect(r.headers()['content-type']).toContain('text/csv');
  const texto = await r.text();
  expect(texto).toContain('Nombre,Email,Rol,Activo,Alta');
  expect(texto).toContain('admin@demo.pe');
});

test('M1: un vendedor no puede descargar el CSV de usuarios', async ({ page }) => {
  await ingresar(page, 'vendedor@demo.pe');
  const r = await page.request.get('/admin/usuarios/csv', { maxRedirects: 0 });
  expect(r.status()).toBe(307);
});
