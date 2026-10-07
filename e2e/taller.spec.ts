import { expect, test } from '@playwright/test';
import { crearLoteConPacking, ingresar } from './ayudas';

test('M4: cola del taller en el celular — en caja → en ensamble', async ({ page, browser }) => {
  // Una unidad nueva en caja, para no alterar los datos demo
  await ingresar(page, 'admin@demo.pe');
  const codigo = await crearLoteConPacking(page, [['DEMO-72', 1]]);
  const vin = `TAL${codigo.slice(-8)}`;
  await page.goto('/inventario/registro');
  await page.getByRole('combobox', { name: 'Lote y modelo' }).click();
  await page.getByRole('option', { name: new RegExp(`${codigo} · DEMO-72`) }).click();
  await page.getByLabel(/Columnas: VIN, motor/).fill(`${vin}\tM${vin}`);
  await page.getByRole('button', { name: 'Agregar a la lista' }).click();
  await page.getByRole('button', { name: 'Registrar 1 unidad(es)' }).click();
  await expect(page.getByText('1 unidad(es) registradas')).toBeVisible();

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
