import { expect, test } from '@playwright/test';
import { ingresar } from './ayudas';

test('M7: búsqueda por VIN o DNI con cobertura, vigencia y días restantes', async ({ page }) => {
  await ingresar(page, 'vendedor@demo.pe', '/garantias');
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('45678912'); // DNI de la venta demo #1
  await expect(page).toHaveURL(/q=45678912/);
  const general = page.getByRole('row', { name: /DEMO72-001.*General/ });
  await expect(general).toContainText('Juana Pérez Quispe');
  await expect(general).toContainText(/Vigente · \d+ días restantes/);
  await expect(page.getByRole('row', { name: /DEMO72-001.*Baterías/ })).toBeVisible();

  await page.getByRole('searchbox', { name: 'Buscar' }).fill('DEMO72-001');
  await expect(page).toHaveURL(/q=DEMO72-001/);
  await expect(page.getByRole('row', { name: /DEMO72-001/ })).toHaveCount(2);

  const csv = await (await page.request.get('/garantias/csv?q=DEMO72-001')).text();
  expect(csv).toContain('VIN,Modelo,Cliente');
  expect(csv).toContain('DEMO72-001');
});

test('M7: el vendedor registra un reclamo y el técnico le da seguimiento hasta cerrarlo', async ({ page, browser }) => {
  const problema = `No enciende el display ${Date.now()}`;
  await ingresar(page, 'vendedor@demo.pe', '/garantias?q=DEMO72-001');
  await page.getByRole('button', { name: 'Registrar reclamo de DEMO72-001 (general)' }).click();
  await page.getByRole('dialog').getByLabel('¿Qué problema reporta el cliente?').fill(problema);
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText('Reclamo registrado')).toBeVisible();
  const reclamo = page.getByRole('row', { name: new RegExp(problema) });
  await expect(reclamo).toContainText('Abierto');
  // El vendedor no atiende reclamos
  await expect(reclamo.getByRole('button', { name: /Atender/ })).toHaveCount(0);

  const tec = await browser.newPage();
  await ingresar(tec, 'tecnico@demo.pe', '/garantias');
  const fila = tec.getByRole('row', { name: new RegExp(problema) });
  await fila.getByRole('button', { name: 'Atender reclamo de DEMO72-001' }).click();
  await tec.getByRole('dialog').getByRole('button', { name: 'Pasar a revisión' }).click();
  await expect(fila).toContainText('En revisión');
  await expect(fila).toContainText('Tito Técnico');

  // Aprobar exige diagnóstico (D27): el mensaje de la BD se muestra tal cual
  await fila.getByRole('button', { name: 'Atender reclamo de DEMO72-001' }).click();
  await tec.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click();
  await expect(tec.getByText('Registra el diagnóstico antes de aprobar o rechazar el reclamo')).toBeVisible();
  await tec.getByRole('dialog').getByLabel('Diagnóstico').fill('Conector del display suelto');
  await tec.getByRole('dialog').getByLabel('Costo de reparación (S/)').fill('35.50');
  await tec.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click();
  await expect(fila).toContainText('Aprobado');
  await expect(fila).toContainText('S/ 35.50');

  await fila.getByRole('button', { name: 'Atender reclamo de DEMO72-001' }).click();
  await tec.getByRole('dialog').getByRole('button', { name: 'Cerrar reclamo' }).click();
  await expect(fila).toContainText('Cerrado');
  await expect(fila.getByRole('button', { name: /Atender/ })).toHaveCount(0);

  // Filtro por estado del reclamo
  await tec.getByRole('combobox', { name: 'Estado del reclamo' }).click();
  await tec.getByRole('option', { name: 'Cerrado' }).click();
  await expect(tec.getByRole('row', { name: new RegExp(problema) })).toBeVisible();
  await tec.close();
});
