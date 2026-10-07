import { expect, test } from '@playwright/test';
import { ingresar } from './ayudas';

test('M1: sin sesión redirige a /login', async ({ page }) => {
  await page.goto('/ventas');
  await expect(page).toHaveURL(/\/login\?next=%2Fventas/);
});

test('M1: credenciales incorrectas muestran el error en español', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@demo.pe');
  await page.getByLabel('Contraseña').fill('incorrecta');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Email o contraseña incorrectos.')).toBeVisible();
});

test('M1: un usuario sin rol ve "Tu cuenta espera aprobación"', async ({ page }) => {
  await ingresar(page, 'pendiente@demo.pe');
  await expect(page).toHaveURL(/\/pendiente/);
  await expect(page.getByText('Tu cuenta espera aprobación')).toBeVisible();
  await page.goto('/lotes');
  await expect(page).toHaveURL(/\/pendiente/);
});

test('M1: el admin entra y vuelve a la ruta pedida; el vendedor no ve /lotes', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe');
  await expect(page.getByText('Rol: Administrador')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login/);

  await ingresar(page, 'vendedor@demo.pe');
  await page.goto('/lotes');
  await expect(page).toHaveURL(/\/$/);
});
