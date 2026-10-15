import { expect, test, type Page } from '@playwright/test';
import { ESCALAS_MAYORISTAS, fijarEscalas, ingresar } from './ayudas';

/** Paso 1 del POS: tipo de venta y cliente → orden en borrador. */
async function nuevaOrden(page: Page, tipo: 'Minorista (x1)' | 'Mayorista (x3)' | 'Distribuidor (x6)', dni = '45678912') {
  await page.goto('/ventas/nueva');
  await page.getByText(tipo).click();
  await page.getByLabel('Nombre o razón social').fill('Cliente E2E');
  await page.getByLabel('N.º de documento').fill(dni);
  await page.getByRole('button', { name: 'Crear orden y agregar unidades' }).click();
  await expect(page.getByText('Orden creada: agrega las unidades')).toBeVisible();
  await expect(page).toHaveURL(/\/ventas\/[0-9a-f-]{36}$/);
}

async function buscar(page: Page, texto: string) {
  await page.getByRole('textbox', { name: 'Buscar unidad' }).fill(texto);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByRole('table', { name: 'Unidades disponibles' })).toBeVisible();
}

async function eliminarBorrador(page: Page) {
  await page.getByRole('button', { name: 'Eliminar borrador' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click();
  await expect(page).toHaveURL(/\/ventas$/);
}

test('RN-20: el documento del cliente se valida antes de crear la orden', async ({ page }) => {
  await ingresar(page, 'vendedor@demo.pe', '/ventas/nueva');
  await page.getByLabel('Nombre o razón social').fill('Empresa SAC');
  await page.getByRole('combobox', { name: 'Tipo de documento' }).click();
  await page.getByRole('option', { name: 'RUC' }).click();
  await page.getByLabel('N.º de documento').fill('30123456789');
  await page.getByRole('button', { name: 'Crear orden y agregar unidades' }).click();
  await expect(page.getByText('RUC: 11 dígitos que empiezan por 10, 15, 17 o 20.')).toBeVisible();
  await expect(page).toHaveURL(/\/ventas\/nueva$/);
});

test('M6: si 2 pestañas intentan vender la misma unidad, la segunda recibe "La unidad no está disponible"', async ({ page, browser }) => {
  await ingresar(page, 'vendedor@demo.pe');
  await nuevaOrden(page, 'Minorista (x1)');
  await buscar(page, 'DEMO-48');

  const otra = await browser.newPage();
  await ingresar(otra, 'vendedor2@demo.pe');
  await nuevaOrden(otra, 'Minorista (x1)', '87654321');
  await buscar(otra, 'DEMO-48');

  // Las dos pestañas ven la misma unidad libre
  const vin = (await page.getByRole('table', { name: 'Unidades disponibles' }).getByRole('row').nth(1).getByRole('cell').first().textContent()) ?? '';
  await expect(otra.getByRole('button', { name: `Agregar ${vin}` })).toBeEnabled();

  await page.getByRole('button', { name: `Agregar ${vin}` }).click();
  await expect(page.getByText(`${vin} agregada (reservada)`)).toBeVisible();
  await expect(page.getByTestId('total-orden')).toHaveText('S/ 5 805.89');

  await otra.getByRole('button', { name: `Agregar ${vin}` }).click();
  await expect(otra.getByText(new RegExp(`La unidad ${vin} no está disponible`))).toBeVisible();
  await expect(otra.getByTestId('total-orden')).toHaveText('S/ 0.00');

  await eliminarBorrador(otra);
  await otra.close();
  await eliminarBorrador(page);
});

test('D31: con solo x1 activa, el POS no muestra selector de escala ni avisos de x3/x6', async ({ page }) => {
  await ingresar(page, 'vendedor@demo.pe', '/ventas/nueva');
  await expect(page.getByTestId('escala-unica')).toHaveText('Minorista (x1)');
  await expect(page.getByRole('radiogroup')).toHaveCount(0);
  await expect(page.getByText('Mayorista (x3)')).toHaveCount(0);
  await expect(page.getByText('Distribuidor (x6)')).toHaveCount(0);

  await nuevaOrden(page, 'Minorista (x1)');
  await expect(page.getByTestId('escala-unica')).toHaveText('Minorista (x1)');
  await expect(page.getByRole('radiogroup')).toHaveCount(0);
  await eliminarBorrador(page);
});

test.describe('con x3 y x6 activas', () => {
  test.beforeEach(() => fijarEscalas(ESCALAS_MAYORISTAS, true));
  test.afterEach(() => fijarEscalas(ESCALAS_MAYORISTAS, false));

  test('M6: una orden x6 con 5 unidades muestra "Faltan 1 unidad para precio distribuidor" y no se confirma', async ({ page }) => {
    await ingresar(page, 'vendedor@demo.pe');
    await nuevaOrden(page, 'Distribuidor (x6)');
    await buscar(page, 'DEMO-48');
    for (let i = 0; i < 5; i++) {
      const agregar = page.getByRole('table', { name: 'Unidades disponibles' }).getByRole('button', { name: /^Agregar / }).first();
      await agregar.click();
      await expect(page.getByRole('table', { name: 'Unidades de la orden' }).getByRole('row')).toHaveCount(i + 3);
    }
    await expect(page.getByTestId('faltan-escala')).toHaveText('Faltan 1 unidad para precio distribuidor');
    await expect(page.getByTestId('total-orden')).toHaveText('S/ 22 175.30'); // 5 × 4 435.06

    // Pago exacto: el saldo llega a 0, pero el mínimo de la escala impide confirmar (RN-14)
    await page.getByRole('button', { name: 'Saldo' }).click();
    await page.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(page.getByTestId('saldo-pendiente')).toHaveText('S/ 0.00');
    await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled();
    await expect(page.getByLabel('Para confirmar')).toContainText('Faltan 1 unidad para precio distribuidor');

    // RN-13: al pasar a x3 se re-cotiza todo y ya se podría confirmar
    await page.getByText('Mayorista (x3)').click();
    await expect(page.getByTestId('total-orden')).toHaveText('S/ 24 563.40'); // 5 × 4 912.68
    await expect(page.getByTestId('faltan-escala')).toHaveCount(0);
    await expect(page.getByTestId('saldo-pendiente')).toHaveText('S/ 2 388.10');

    await eliminarBorrador(page);
  });

  test('D31: si se desactiva la escala de un borrador, no se confirma hasta cambiarla', async ({ page }) => {
    await ingresar(page, 'vendedor@demo.pe');
    await nuevaOrden(page, 'Mayorista (x3)');
    await buscar(page, 'DEMO-48');
    for (let i = 0; i < 3; i++) {
      await page.getByRole('table', { name: 'Unidades disponibles' }).getByRole('button', { name: /^Agregar / }).first().click();
      await expect(page.getByRole('table', { name: 'Unidades de la orden' }).getByRole('row')).toHaveCount(i + 3);
    }
    await page.getByRole('button', { name: 'Saldo' }).click();
    await page.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeEnabled();

    await fijarEscalas(['mayorista_x3'], false);
    await page.reload();
    await expect(page.getByTestId('escala-desactivada')).toContainText('Mayorista (x3)');
    await expect(page.getByTestId('faltan-escala')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled();
    await expect(page.getByLabel('Para confirmar')).toContainText('La venta mayorista está desactivada');
    // Se ofrecen solo las activas (x1 y x6) para cambiarla
    await expect(page.getByRole('radio')).toHaveCount(2);

    await eliminarBorrador(page);
  });
});
