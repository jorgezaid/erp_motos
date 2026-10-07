import { expect, test } from '@playwright/test';
import { ingresar, unidadNuevaEnCaja } from './ayudas';

test('M4: cola del taller en el celular — en caja → en ensamble', async ({ page, browser }) => {
  // Una unidad nueva en caja, para no alterar los datos demo
  await ingresar(page, 'admin@demo.pe');
  const vin = await unidadNuevaEnCaja(page, 'DEMO-72', 'TAL');

  const movil = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ingresar(movil, 'tecnico@demo.pe', '/taller');
  await expect(movil.getByRole('heading', { name: 'Taller' })).toBeVisible();
  // La cola no muestra unidades en tienda
  await expect(movil.getByText('DEMO48-001')).toHaveCount(0);

  await movil.getByRole('searchbox', { name: 'Buscar' }).fill(vin);
  const tarjeta = movil.getByRole('list', { name: 'Cola del taller' }).getByRole('listitem').filter({ hasText: vin });
  await expect(tarjeta).toContainText('En caja');
  await expect(tarjeta).toContainText('Baterías 0/6');
  await tarjeta.getByRole('button', { name: `Iniciar ensamble de ${vin}` }).click();
  await expect(movil.getByText(`${vin} en ensamble`)).toBeVisible();
  await expect(tarjeta).toContainText('En ensamble');
  await expect(tarjeta.getByRole('link', { name: `Abrir ${vin}` })).toBeVisible();
  await movil.close();
});

test('M4: unidad de 72V — 6 casillas, inspección con 5 baterías observada, luego pasa a tienda', async ({ page, browser }) => {
  await ingresar(page, 'admin@demo.pe');
  const vin = await unidadNuevaEnCaja(page, 'DEMO-72', 'INS');

  const movil = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ingresar(movil, 'tecnico@demo.pe', `/taller?q=${vin}`);
  await movil.getByRole('button', { name: `Iniciar ensamble de ${vin}` }).click();
  await movil.getByRole('link', { name: `Abrir ${vin}` }).click();
  await expect(movil.getByRole('heading', { name: vin })).toBeVisible();

  // 72V → 6 casillas de batería
  await expect(movil.getByRole('list', { name: 'Seriales de batería' }).getByRole('listitem')).toHaveCount(6);

  // Escanea 5 seriales (Enter = siguiente casilla) y guarda
  await movil.getByLabel('Serial de batería 1').click();
  for (let i = 1; i <= 5; i++) {
    await movil.keyboard.type(`B${vin}-${i}`);
    await movil.keyboard.press('Enter');
  }
  await expect(movil.getByLabel('Serial de batería 6')).toBeFocused();
  await movil.getByRole('button', { name: 'Guardar seriales' }).click();
  await expect(movil.getByText('5 serial(es) guardados')).toBeVisible();
  await expect(movil.getByText('5 de 6 registradas')).toBeVisible();

  // Inspección con 5 baterías → Observada, y "Pasar a tienda" sigue deshabilitado
  await movil.getByLabel('Baterías contadas').fill('5');
  await movil.getByRole('checkbox', { name: 'VIN verificado' }).click();
  await movil.getByRole('checkbox', { name: 'Motor verificado' }).click();
  await expect(movil.getByText('Quedará observada: Se contaron 5 baterías; el modelo lleva 6.')).toBeVisible();
  await movil.getByRole('button', { name: 'Registrar inspección' }).click();
  await expect(movil.getByText('Inspección registrada como observada')).toBeVisible();
  await expect(movil.getByTestId('ultima-inspeccion')).toContainText('observada');
  await movil.getByRole('combobox', { name: 'Ubicación' }).click();
  await movil.getByRole('option', { name: 'Showroom Piérola' }).click();
  await expect(movil.getByRole('button', { name: 'Pasar a tienda' })).toBeDisabled();
  await expect(movil.getByLabel('Requisitos pendientes')).toContainText('Registra los seriales de batería (5 de 6)');
  await expect(movil.getByLabel('Requisitos pendientes')).toContainText('La última inspección está observada');

  // Completa la 6.ª batería y una inspección nueva, aprobada
  await movil.getByLabel('Serial de batería 6').fill(`B${vin}-6`);
  await movil.getByRole('button', { name: 'Guardar seriales' }).click();
  await expect(movil.getByText('6 de 6 registradas')).toBeVisible();
  await movil.getByLabel('Baterías contadas').fill('6');
  await movil.getByRole('checkbox', { name: 'VIN verificado' }).click();
  await movil.getByRole('checkbox', { name: 'Motor verificado' }).click();
  await movil.getByRole('button', { name: 'Registrar inspección' }).click();
  await expect(movil.getByText('Inspección aprobada')).toBeVisible();

  await movil.getByRole('combobox', { name: 'Ubicación' }).click();
  await movil.getByRole('option', { name: 'Showroom Piérola' }).click();
  await expect(movil.getByRole('button', { name: 'Pasar a tienda' })).toBeEnabled();
  await movil.getByRole('button', { name: 'Pasar a tienda' }).click();
  await expect(movil.getByText(`${vin} lista en tienda`)).toBeVisible();
  await expect(movil).toHaveURL(/\/taller$/);

  await movil.goto(`/inventario?q=${vin}`);
  await expect(movil.getByRole('row', { name: new RegExp(vin) })).toContainText('Listo en tienda');
  await movil.close();
});

test('RN-02/RN-03: un serial de batería repetido muestra el error de la BD', async ({ page }) => {
  await ingresar(page, 'admin@demo.pe');
  const vin = await unidadNuevaEnCaja(page, 'DEMO-48', 'BAT');
  await page.goto(`/taller?q=${vin}`);
  await page.getByRole('button', { name: `Iniciar ensamble de ${vin}` }).click();
  await page.getByRole('link', { name: `Abrir ${vin}` }).click();
  await page.getByLabel('Serial de batería 1').fill('BAT-DEMO48-001-1');
  await page.getByRole('button', { name: 'Guardar seriales' }).click();
  await expect(page.getByText('El serial de batería ya está registrado.')).toBeVisible();
});
