import { expect, test } from '@playwright/test';
import { ingresar, pestanaLote } from './ayudas';

test('M3: pestañas Unidades y Auditoría del lote', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe', '/lotes?q=DEMO-ALM-002');
  await page.getByRole('link', { name: 'DEMO-ALM-002' }).click();

  await pestanaLote(page, 'Unidades');
  await expect(page.getByRole('row', { name: /DEMO60-001/ })).toContainText('En caja');
  await expect(page.getByText('Mostrando 1–3 de 3')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('DEMO60-002');
  await expect(page.getByText('Mostrando 1–1 de 1')).toBeVisible();

  const csv = await (await page.request.get(page.url().replace('/unidades', '/unidades/csv'))).text();
  expect(csv).toContain('VIN,Motor,Modelo');
  expect(csv).toContain('DEMO60-002');
  expect(csv).not.toContain('DEMO60-001');

  // Auditoría: faltan 2 por registrar y 3 unidades sin baterías, en rojo
  await pestanaLote(page, 'Auditoría');
  await expect(page.getByText('1 modelo(s) con diferencias')).toBeVisible();
  const fila = page.getByRole('row', { name: /DEMO-60/ });
  await expect(fila).toHaveAttribute('data-alerta', 'true');
  await expect(fila).toContainText('Faltan registrar 2 de 5');
  await expect(fila).toContainText('3 unidad(es) con baterías incompletas');
});

test('M3: en un lote liquidado la pestaña Unidades muestra el costo landing (solo admin)', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe', '/lotes?q=DEMO-LIQ-001');
  await page.getByRole('link', { name: 'DEMO-LIQ-001' }).click();
  await pestanaLote(page, 'Unidades');
  await expect(page.getByRole('row', { name: /DEMO48-001/ })).toContainText('S/ 3 193.24');
  await expect(page.getByRole('row', { name: /DEMO72-001/ })).toContainText('Vendido');
});
