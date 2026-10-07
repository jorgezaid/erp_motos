import { expect, test } from '@playwright/test';
import { ingresar } from './ayudas';

test('M2: alta, edición y filtro de ubicaciones', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe', '/admin/ubicaciones');
  await expect(page.getByRole('cell', { name: 'Showroom Piérola', exact: true })).toBeVisible();

  const nombre = `Tienda E2E ${Date.now()}`;
  await page.getByRole('button', { name: 'Nueva ubicación' }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Nombre').fill(nombre);
  await dialogo.getByRole('combobox', { name: 'Tipo' }).click();
  await page.getByRole('option', { name: 'Showroom' }).click();
  await dialogo.getByLabel('Dirección').fill('Av. Nicolás de Piérola 123');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Ubicación creada')).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(nombre) })).toContainText('Showroom');

  // Nombre repetido
  await page.getByRole('button', { name: 'Nueva ubicación' }).click();
  await page.getByRole('dialog').getByLabel('Nombre').fill(nombre);
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('El nombre ya está registrado.')).toBeVisible();
  await page.keyboard.press('Escape');

  // Desactivar y filtrar
  await page.getByRole('button', { name: `Editar ${nombre}` }).click();
  await page.getByRole('dialog').getByRole('switch', { name: 'Activa' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Ubicación actualizada')).toBeVisible();

  await page.getByRole('combobox', { name: 'Estado' }).click();
  await page.getByRole('option', { name: 'Inactivas' }).click();
  await expect(page.getByRole('row', { name: new RegExp(nombre) })).toContainText('Inactiva');
  await expect(page.getByRole('cell', { name: 'Showroom Piérola', exact: true })).toHaveCount(0);
});
