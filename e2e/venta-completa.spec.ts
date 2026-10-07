import { expect, test, type Page } from '@playwright/test';
import { ingresar } from './ayudas';

// Ventas confirmadas: consumen unidades de DEMO-LIQ-001 (7 DEMO-48 por corrida; hay 24).
// Si se agota el stock demo: `pnpm e2e:limpio` (reinicia la BD local).

async function crearOrden(page: Page, tipo: string, cliente: string, doc: { tipo: 'DNI' | 'RUC'; numero: string }) {
  await page.goto('/ventas/nueva');
  await page.getByText(tipo).click();
  await page.getByLabel('Nombre o razón social').fill(cliente);
  if (doc.tipo === 'RUC') {
    await page.getByRole('combobox', { name: 'Tipo de documento' }).click();
    await page.getByRole('option', { name: 'RUC' }).click();
  }
  await page.getByLabel('N.º de documento').fill(doc.numero);
  await page.getByRole('button', { name: 'Crear orden y agregar unidades' }).click();
  await expect(page).toHaveURL(/\/ventas\/[0-9a-f-]{36}$/);
}

async function agregarUnidades(page: Page, busqueda: string, cantidad: number): Promise<string[]> {
  await page.getByRole('textbox', { name: 'Buscar unidad' }).fill(busqueda);
  await page.getByRole('button', { name: 'Buscar' }).click();
  const disponibles = page.getByRole('table', { name: 'Unidades disponibles' }).getByRole('button', { name: /^Agregar / });
  await expect(disponibles.first()).toBeVisible();
  expect(await disponibles.count(), 'Sin stock demo suficiente: ejecuta `pnpm e2e:limpio`').toBeGreaterThanOrEqual(cantidad);

  const vins: string[] = [];
  for (let i = 0; i < cantidad; i++) {
    const boton = disponibles.first();
    vins.push(((await boton.getAttribute('aria-label')) ?? '').replace('Agregar ', ''));
    await boton.click();
    await expect(page.getByRole('table', { name: 'Unidades de la orden' }).getByRole('row')).toHaveCount(i + 3);
  }
  return vins;
}

async function pagar(page: Page, metodo: 'Efectivo' | 'Transferencia' | 'Tarjeta', monto: string | 'saldo', referencia = '') {
  await page.getByRole('combobox', { name: 'Método de pago' }).click();
  await page.getByRole('option', { name: metodo }).click();
  if (monto === 'saldo') await page.getByRole('button', { name: 'Saldo' }).click();
  else await page.getByLabel('Monto (S/)').fill(monto);
  if (referencia) await page.getByLabel('Referencia (n.º de operación)').fill(referencia);
  await page.getByRole('button', { name: 'Registrar pago' }).click();
  await expect(page.getByRole('table', { name: 'Pagos de la orden' })).toBeVisible();
}

async function confirmar(page: Page) {
  await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirmar venta' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Confirmada');
}

test('7.4: venta x1 con pago mixto (efectivo + tarjeta) genera garantías y marca la unidad vendida', async ({ page }) => {
  await ingresar(page, 'vendedor@demo.pe');
  await crearOrden(page, 'Minorista (x1)', 'Carlos Huamán', { tipo: 'DNI', numero: '70123456' });
  const [vin] = await agregarUnidades(page, 'DEMO-48', 1);
  await expect(page.getByTestId('total-orden')).toHaveText('S/ 5 805.89');

  // Pago parcial: el saldo pendiente siempre visible
  await pagar(page, 'Efectivo', '2 000');
  await expect(page.getByTestId('saldo-pendiente')).toHaveText('S/ 3 805.89');
  await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled();
  await expect(page.getByLabel('Para confirmar')).toContainText('Falta cobrar S/ 3805.89');

  await pagar(page, 'Tarjeta', 'saldo', 'VOUCHER-778');
  await expect(page.getByTestId('saldo-pendiente')).toHaveText('S/ 0.00');
  await confirmar(page);

  const nota = page.getByRole('article', { name: 'Nota de venta' });
  await expect(nota).toContainText('Pagos · Mixto');
  await expect(nota.getByRole('list', { name: 'Pagos' })).toContainText('Efectivo: S/ 2 000.00');
  await expect(nota.getByRole('list', { name: 'Pagos' })).toContainText('Tarjeta: S/ 3 805.89 (ref. VOUCHER-778)');
  await expect(page.getByTestId('total-nota')).toHaveText('S/ 5 805.89');
  // RN-16: garantía general (12 meses) y de baterías (6 meses) desde hoy (Lima)
  await expect(nota).toContainText('General:');
  await expect(nota).toContainText('Baterías:');

  await page.goto(`/inventario?q=${vin}`);
  await expect(page.getByRole('row', { name: new RegExp(vin ?? '') })).toContainText('Vendido');
});

test('7.4: venta x6 (distribuidor) al precio de la escala, pagada por transferencia', async ({ page }) => {
  await ingresar(page, 'vendedor@demo.pe');
  await crearOrden(page, 'Distribuidor (x6)', 'Motos del Norte SAC', { tipo: 'RUC', numero: '20512345678' });
  const vins = await agregarUnidades(page, 'DEMO-48', 6);
  await expect(page.getByTestId('faltan-escala')).toHaveCount(0);
  await expect(page.getByTestId('total-orden')).toHaveText('S/ 26 610.36'); // 6 × 4 435.06

  await pagar(page, 'Transferencia', 'saldo', 'OP-998877');
  await confirmar(page);

  const nota = page.getByRole('article', { name: 'Nota de venta' });
  await expect(nota).toContainText('Distribuidor (x6)');
  await expect(nota).toContainText('Pagos · Transferencia');
  await expect(nota.getByRole('table', { name: 'Detalle de la venta' }).getByRole('row')).toHaveCount(8); // encabezado + 6 + total
  for (const vin of vins) await expect(nota).toContainText(vin);

  // En el listado: confirmada, transferencia y total de la escala
  await page.goto('/ventas?q=20512345678');
  await expect(page.getByRole('row', { name: /Motos del Norte SAC/ }).first()).toContainText('S/ 26 610.36');
});
