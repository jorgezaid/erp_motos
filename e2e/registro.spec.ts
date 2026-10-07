import { expect, test } from '@playwright/test';
import { crearLoteConPacking, ingresar } from './ayudas';

test('M4: el técnico registra unidades pegando desde Excel y con escáner, hasta el packing list', async ({ page, browser }) => {
  await ingresar(page, 'admin@demo.pe');
  const codigo = await crearLoteConPacking(page, [['DEMO-60', 3]]);
  const sufijo = codigo.slice(-6);

  const tec = await browser.newPage();
  await ingresar(tec, 'tecnico@demo.pe', '/inventario/registro');
  await tec.getByRole('combobox', { name: 'Lote y modelo' }).click();
  await tec.getByRole('option', { name: new RegExp(`${codigo} · DEMO-60 — Faltan 3 de 3`) }).click();
  await expect(tec.getByTestId('faltantes')).toHaveText('Faltan 3 de 3');

  // Pegar desde Excel (con encabezado, tabuladores y minúsculas)
  await tec.getByLabel(/Columnas: VIN, motor/).fill(
    `VIN\tMotor\tColor 1\tColor 2\nvin${sufijo}a\tmot${sufijo}a\tRojo\tNegro\nVIN${sufijo}B\tMOT${sufijo}B\tAzul\t`,
  );
  await tec.getByRole('button', { name: 'Agregar a la lista' }).click();
  await expect(tec.getByRole('cell', { name: `VIN${sufijo}A`.toUpperCase() })).toBeVisible();

  // Escáner: Enter pasa del VIN al motor, y Enter en el motor agrega la fila
  await tec.getByRole('tab', { name: 'Escanear' }).click();
  await tec.getByLabel('VIN', { exact: true }).fill(`VIN${sufijo}C`);
  await tec.keyboard.press('Enter');
  await expect(tec.getByLabel('Motor', { exact: true })).toBeFocused();
  await tec.keyboard.type(`MOT${sufijo}C`);
  await tec.keyboard.press('Enter');
  await expect(tec.getByLabel('VIN', { exact: true })).toBeFocused();

  // Una cuarta unidad excede el packing list (RN-04)
  await tec.getByLabel('VIN', { exact: true }).fill(`VIN${sufijo}D`);
  await tec.keyboard.press('Enter');
  await tec.keyboard.type(`MOT${sufijo}D`);
  await tec.keyboard.press('Enter');
  await expect(tec.getByText('Hay 4 unidades y el packing list solo admite 3 más (RN-04).')).toBeVisible();
  await expect(tec.getByRole('button', { name: 'Registrar 4 unidad(es)' })).toBeDisabled();
  await tec.getByRole('button', { name: 'Quitar fila 4' }).click();

  await tec.getByRole('button', { name: 'Registrar 3 unidad(es)' }).click();
  await expect(tec.getByText('3 unidad(es) registradas')).toBeVisible();

  await tec.goto(`/inventario?q=${sufijo}`);
  await expect(tec.getByText('Mostrando 1–3 de 3')).toBeVisible();
  await expect(tec.getByRole('row', { name: new RegExp(`VIN${sufijo}A`) })).toContainText('Rojo / Negro');
  await tec.close();
});

test('RN-03: un VIN ya registrado muestra el error de la BD', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe');
  const codigo = await crearLoteConPacking(page, [['DEMO-48', 1]]);
  await page.goto('/inventario/registro');
  await page.getByRole('combobox', { name: 'Lote y modelo' }).click();
  await page.getByRole('option', { name: new RegExp(`${codigo} · DEMO-48`) }).click();
  await page.getByLabel(/Columnas: VIN, motor/).fill('DEMO48-001\tMOTOR-NUEVO');
  await page.getByRole('button', { name: 'Agregar a la lista' }).click();
  await page.getByRole('button', { name: 'Registrar 1 unidad(es)' }).click();
  await expect(page.getByText('El VIN ya está registrado.')).toBeVisible();
});
