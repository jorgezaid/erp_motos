import { expect, type Page } from '@playwright/test';

export const PASSWORD_DEMO = 'Demo1234!';

/** Como admin: crea un lote con un packing list (modelo, cantidad) y devuelve su código. */
export async function crearLoteConPacking(page: Page, lineas: [modelo: string, cantidad: number][]): Promise<string> {
  const codigo = `E2E${Date.now()}`;
  await page.goto('/lotes');
  await page.getByRole('button', { name: 'Nuevo lote' }).click();
  await page.getByRole('dialog').getByLabel('Código de embarque').fill(codigo);
  await page.getByRole('dialog').getByRole('button', { name: 'Crear lote' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(codigo) })).toBeVisible();
  await pestanaLote(page, 'Packing list');
  for (const [modelo, q] of lineas) {
    await page.getByRole('button', { name: 'Agregar modelo' }).click();
    await page.getByRole('dialog').getByRole('combobox', { name: 'Modelo' }).click();
    await page.getByRole('option', { name: modelo }).click();
    await page.getByRole('dialog').getByLabel('Cantidad (packing list)').fill(String(q));
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('row', { name: new RegExp(modelo) })).toBeVisible();
  }
  return codigo;
}

/** Como admin: crea un lote con 1 unidad del modelo y la registra (queda en caja). Devuelve el VIN. */
export async function unidadNuevaEnCaja(page: Page, modelo: string, prefijo = 'U'): Promise<string> {
  const codigo = await crearLoteConPacking(page, [[modelo, 1]]);
  const vin = `${prefijo}${codigo.slice(-9)}`;
  await page.goto('/inventario/registro');
  await page.getByRole('combobox', { name: 'Lote y modelo' }).click();
  await page.getByRole('option', { name: new RegExp(`${codigo} · ${modelo}`) }).click();
  await page.getByLabel(/Columnas: VIN, motor/).fill(`${vin}\tM${vin}`);
  await page.getByRole('button', { name: 'Agregar a la lista' }).click();
  await page.getByRole('button', { name: 'Registrar 1 unidad(es)' }).click();
  await expect(page.getByText('1 unidad(es) registradas')).toBeVisible();
  return vin;
}

/** Abre una pestaña de /lotes/[id] (sin confundirla con los enlaces del sidebar). */
export async function pestanaLote(page: Page, nombre: string) {
  await page.getByRole('navigation', { name: 'Secciones del lote' }).getByRole('link', { name: nombre, exact: true }).click();
}

/** Inicia sesión con un usuario de supabase/demo/01_usuarios_demo.sql (cargado con `pnpm db:demo`) */
export async function ingresar(page: Page, email: string, destino = '/') {
  await page.goto(`/login${destino === '/' ? '' : `?next=${encodeURIComponent(destino)}`}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD_DEMO);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
