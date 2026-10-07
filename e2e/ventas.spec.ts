import { expect, test, type Page } from '@playwright/test';
import { ingresar } from './ayudas';

/** Venta x1 confirmada de una unidad DEMO-48 (pago en efectivo). Devuelve el VIN. */
async function ventaX1(page: Page): Promise<string> {
  await page.goto('/ventas/nueva');
  await page.getByLabel('Nombre o razón social').fill('Cliente Anulación');
  await page.getByLabel('N.º de documento').fill('41234567');
  await page.getByRole('button', { name: 'Crear orden y agregar unidades' }).click();
  await expect(page).toHaveURL(/\/ventas\/[0-9a-f-]{36}$/);
  await page.getByRole('textbox', { name: 'Buscar unidad' }).fill('DEMO-48');
  await page.getByRole('button', { name: 'Buscar' }).click();
  const fila = page.getByRole('table', { name: 'Unidades disponibles' }).getByRole('row').nth(1);
  const vin = (await fila.getByRole('cell').first().textContent()) ?? '';
  await fila.getByRole('button', { name: `Agregar ${vin}` }).click();
  await expect(page.getByTestId('total-orden')).toHaveText('S/ 5 805.89');
  await page.getByRole('button', { name: 'Saldo' }).click();
  await page.getByRole('button', { name: 'Registrar pago' }).click();
  await expect(page.getByTestId('saldo-pendiente')).toHaveText('S/ 0.00');
  await page.getByRole('button', { name: 'Confirmar venta' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(page.getByRole('article', { name: 'Nota de venta' })).toBeVisible();
  return vin;
}

test('M6: /ventas lista y busca órdenes; la nota de venta muestra pagos mixtos y garantías', async ({ page }) => {
  await ingresar(page, 'vendedor@demo.pe', '/ventas');
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('45678912');
  await expect(page).toHaveURL(/q=45678912/);
  const fila = page.getByRole('row', { name: /Juana Pérez Quispe/ }).first();
  await expect(fila).toContainText('Confirmada');
  await expect(fila).toContainText('Mixto');
  await expect(fila).toContainText('S/ 16 287.80');

  await fila.getByRole('link').first().click();
  const nota = page.getByRole('article', { name: 'Nota de venta' });
  await expect(nota).toContainText('Nota de venta interna');
  await expect(nota).toContainText('DEMO72-001');
  await expect(page.getByTestId('total-nota')).toHaveText('S/ 16 287.80');
  await expect(nota.getByRole('list', { name: 'Pagos' })).toContainText('Efectivo: S/ 5 000.00');
  await expect(nota.getByRole('list', { name: 'Pagos' })).toContainText('Transferencia: S/ 11 287.80 (ref. OP-000123)');
  await expect(nota).toContainText('General:');
  await expect(nota).toContainText('Baterías:');

  // Imprimible: al imprimir se oculta el sidebar y quedan solo los datos de la nota
  await expect(page.getByRole('button', { name: 'Imprimir nota de venta' })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('complementary')).toBeHidden();
  await expect(nota).toBeVisible();
  await page.emulateMedia({ media: 'screen' });

  // El vendedor no puede anular (solo admin)
  await expect(page.getByRole('button', { name: 'Anular' })).toHaveCount(0);

  const csv = await (await page.request.get('/ventas/csv?estado=confirmada')).text();
  expect(csv).toContain('N.º,Fecha,Cliente');
  expect(csv).toContain('Juana Pérez Quispe');
});

test('RN-17: en una venta confirmada solo se cambian teléfono y email', async ({ page }) => {
  await ingresar(page, 'vendedor@demo.pe', '/ventas?q=45678912');
  await page.getByRole('row', { name: /Juana Pérez Quispe/ }).first().getByRole('link').first().click();
  await page.getByRole('button', { name: 'Editar contacto' }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByLabel('Nombre o razón social')).toBeDisabled();
  await expect(dialogo.getByLabel('N.º de documento')).toBeDisabled();
  await dialogo.getByLabel('Teléfono').fill('912345678');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Contacto actualizado')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Nota de venta' })).toContainText('912345678');
});

test('RN-17: el admin anula una venta con motivo; la unidad vuelve a tienda y la garantía se anula', async ({ page, browser }) => {
  const vendedor = await browser.newPage();
  await ingresar(vendedor, 'vendedor@demo.pe');
  const vin = await ventaX1(vendedor);
  const url = vendedor.url();
  await vendedor.close();

  await ingresar(page, 'admin@demo.pe');
  await page.goto(url);
  await page.getByRole('button', { name: 'Anular' }).click();
  const dialogo = page.getByRole('alertdialog');
  await dialogo.getByRole('button', { name: 'Anular venta' }).click();
  await expect(page.getByText('Indica el motivo de la anulación (mínimo 5 caracteres).')).toBeVisible();
  await dialogo.getByLabel('Motivo (obligatorio)').fill('Cliente desistió de la compra');
  await dialogo.getByRole('button', { name: 'Anular venta' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Anulada');
  const nota = page.getByRole('article', { name: 'Nota de venta' });
  await expect(nota).toContainText('ANULADA');
  await expect(nota).toContainText('Motivo: Cliente desistió de la compra');
  // Las dos garantías (general y baterías) aparecen tachadas: anuladas
  await expect(nota.locator('.line-through')).toHaveCount(2);

  await page.goto(`/inventario?q=${vin}`);
  await expect(page.getByRole('row', { name: new RegExp(vin) })).toContainText('Listo en tienda');
});
