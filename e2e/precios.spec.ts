import { expect, test } from '@playwright/test';
import { ingresar } from './ayudas';

test('M5: si un vendedor inspecciona la respuesta de red, no aparece ningún costo', async ({ page }) => {
  const cuerpos: string[] = [];
  // Datos que llegan al navegador: HTML y payload RSC (no el código JS del bundle)
  page.on('response', (r) => {
    if (r.url().startsWith('http://127.0.0.1') && ['document', 'fetch', 'xhr'].includes(r.request().resourceType())) {
      r.text().then((t) => cuerpos.push(t)).catch(() => {});
    }
  });
  await ingresar(page, 'vendedor@demo.pe', '/precios');
  const fila = page.getByRole('row', { name: /DEMO-48/ }).filter({ hasText: 'S/ 5 805.89' }).first();
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('S/ 4 912.68');
  await expect(fila).toContainText('S/ 4 435.06');
  await expect(page.getByRole('columnheader', { name: /costo/i })).toHaveCount(0);

  // Navegación cliente (RSC) y CSV: tampoco traen costos
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('DEMO-72');
  await expect(page.getByRole('row', { name: /DEMO-72/ }).first()).toBeVisible();
  const csv = await (await page.request.get('/precios/csv')).text();
  cuerpos.push(csv);
  await page.waitForTimeout(500);

  const todo = cuerpos.join('\n');
  expect(todo).toContain('5805.89');
  // Costos unitarios de DEMO-48 / DEMO-72 y nombres de campos de costo
  expect(todo).not.toContain('3193.24');
  expect(todo).not.toContain('8958.29');
  expect(todo).not.toMatch(/costo_landing|costo_total|v_price_matrix|utilidad/);
});

test('M5: el admin edita un precio manual (marcado) y los márgenes; el vendedor ve el cambio', async ({ page, browser }) => {
  await ingresar(page, 'admin@demo.pe', '/precios?q=DEMO-LIQ-001');
  const fila = page.getByRole('row', { name: /DEMO-48.*DEMO-LIQ-001/ });
  await expect(fila).toContainText('S/ 3 193.24');
  await expect(fila).toContainText('S/ 5 805.89');

  // Precio manual x1 = 5 790 (redondeo comercial)
  await fila.getByRole('button', { name: 'Editar precio x1 de DEMO-48 (DEMO-LIQ-001)' }).click();
  await fila.getByRole('textbox', { name: /Nuevo precio x1/ }).fill('5 790');
  await fila.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByText('Precio manual guardado')).toBeVisible();
  await expect(fila).toContainText('manual');
  await expect(fila).toContainText('S/ 5 790.00');
  await expect(fila).toContainText('sugerido S/ 5 805.89');

  const vendedor = await browser.newPage();
  await ingresar(vendedor, 'vendedor@demo.pe', '/precios?q=DEMO-48');
  await expect(vendedor.getByRole('row', { name: /DEMO-48/ }).filter({ hasText: 'S/ 5 790.00' })).toBeVisible();

  // RN-09: cambiar el margen x3 recalcula los sugeridos y conserva el manual x1
  await page.getByLabel('Margen x3 (%)').fill('36');
  await page.getByRole('button', { name: 'Guardar márgenes' }).click();
  await expect(page.getByText(/Márgenes guardados/)).toBeVisible();
  await expect(fila).toContainText('S/ 4 989.44'); // 3193.24 / 0.64
  await expect(fila).toContainText('S/ 5 790.00');

  // Deja todo como estaba
  await page.getByLabel('Margen x3 (%)').fill('35');
  await page.getByRole('button', { name: 'Guardar márgenes' }).click();
  await expect(fila).toContainText('S/ 4 912.68');
  await fila.getByRole('button', { name: 'Editar precio x1 de DEMO-48 (DEMO-LIQ-001)' }).click();
  await fila.getByRole('textbox', { name: /Nuevo precio x1/ }).fill('');
  await fila.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByText('Se usará el precio sugerido')).toBeVisible();
  await expect(fila).toContainText('S/ 5 805.89');
  await expect(fila).not.toContainText('manual');
  await vendedor.close();
});

test('M5: el técnico no entra a /precios', async ({ page }) => {
  await ingresar(page, 'tecnico@demo.pe');
  await page.goto('/precios');
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
});
