import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { Decimal } from '../src/lib/decimal';
import type { Database } from '../src/types/database';
import { ingresar, PASSWORD_DEMO } from './ayudas';

// M9 · Gastos (solo admin). Corre con `--workers=1`. Cada gasto lleva el prefijo E2E_GASTO y se
// borra en afterAll (con su comprobante), para no dejar datos de prueba en la BD local.
const PREFIJO = 'E2E_GASTO';
const BUCKET = 'comprobantes-gastos';
/** PNG de 1×1 */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());

async function clienteDemo(email: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) process.loadEnvFile('.env.local');
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey } = process.env;
  if (!url || !anonKey) throw new Error('falta .env.local (ejecuta `pnpm env:local`)');
  const supabase = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD_DEMO });
  if (error) throw new Error(error.message);
  return supabase;
}

test.afterAll(async () => {
  const supabase = await clienteDemo('admin@demo.pe');
  const { data, error } = await supabase.from('gastos').delete().like('descripcion', `${PREFIJO}%`).select('comprobante_path');
  if (error) throw new Error(error.message);
  const rutas = (data ?? []).map((g) => g.comprobante_path).filter((r): r is string => !!r);
  if (rutas.length > 0) await supabase.storage.from(BUCKET).remove(rutas);
  await supabase.auth.signOut();
});

/** `S/ 1 234.56` o `S/ -800.00` → Decimal */
async function montoDe(page: Page, testId: string): Promise<Decimal> {
  const texto = (await page.getByTestId(testId).textContent()) ?? '';
  return new Decimal(texto.replace('S/', '').replace(/\s/g, ''));
}

async function nuevoGasto(
  page: Page,
  g: { descripcion: string; monto: string; estado?: 'Realizado' | 'Planificado'; fechaEstimada?: string; comprobante?: boolean },
) {
  await page.getByRole('button', { name: 'Nuevo gasto' }).click();
  const dialogo = page.getByRole('dialog');
  if (g.estado === 'Planificado') {
    await dialogo.getByRole('combobox', { name: 'Estado' }).click();
    await page.getByRole('option', { name: 'Planificado' }).click();
    await dialogo.getByLabel('Fecha estimada').fill(g.fechaEstimada ?? hoy);
  } else {
    await dialogo.getByLabel('Fecha de pago').fill(hoy);
    await dialogo.getByRole('combobox', { name: 'Método de pago' }).click();
    await page.getByRole('option', { name: 'Transferencia' }).click();
  }
  await dialogo.getByRole('combobox', { name: 'Categoría' }).click();
  await page.getByRole('option', { name: 'Servicios' }).click();
  await dialogo.getByLabel('Descripción').fill(g.descripcion);
  await dialogo.getByLabel('Proveedor (opcional)').fill('Proveedor E2E');
  await dialogo.getByLabel(/^Monto/).fill(g.monto);
  if (g.comprobante) {
    await dialogo.getByLabel('Comprobante (opcional)').setInputFiles({ name: 'recibo luz.png', mimeType: 'image/png', buffer: PNG });
  }
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Gasto registrado').first()).toBeVisible();
  await expect(dialogo).toBeHidden();
}

test('M9: el admin registra un gasto con comprobante, lo ve en la lista y descuenta la utilidad neta del mes', async ({ page }) => {
  const descripcion = `${PREFIJO} luz ${Date.now()}`;
  await ingresar(page, 'admin@demo.pe');
  const gastosAntes = await montoDe(page, 'utilidad-gastos');
  const netaAntes = await montoDe(page, 'utilidad-neta');

  await page.getByRole('link', { name: 'Gastos', exact: true }).click();
  await expect(page).toHaveURL(/\/gastos$/);
  const realizadoAntes = await montoDe(page, 'total-realizado');

  await nuevoGasto(page, { descripcion, monto: '350.55', comprobante: true });
  const fila = page.getByRole('row', { name: new RegExp(descripcion) });
  await expect(fila).toContainText('Realizado');
  await expect(fila).toContainText('S/ 350.55');
  await expect(fila).toContainText('Transferencia');
  expect((await montoDe(page, 'total-realizado')).minus(realizadoAntes).toFixed(2)).toBe('350.55');

  // RN-24: el comprobante se abre con una URL firmada del bucket privado
  const [popup] = await Promise.all([page.waitForEvent('popup'), fila.getByRole('link', { name: /Ver comprobante/ }).click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toContain(`/storage/v1/object/sign/${BUCKET}/`);
  await popup.close();

  // CSV con los mismos filtros
  const descarga = page.waitForEvent('download');
  await page.getByRole('link', { name: 'CSV' }).click();
  expect((await descarga).suggestedFilename()).toMatch(/^gastos-\d{4}-\d{2}-/);

  // RN-23: el gasto realizado se resta de la utilidad neta del mes
  await page.goto('/');
  expect((await montoDe(page, 'utilidad-gastos')).minus(gastosAntes).toFixed(2)).toBe('350.55');
  expect(netaAntes.minus(await montoDe(page, 'utilidad-neta')).toFixed(2)).toBe('350.55');
});

test('M9: un gasto planificado aparece en Planificados y se marca como realizado con el monto real', async ({ page }) => {
  const descripcion = `${PREFIJO} alquiler ${Date.now()}`;
  const mes = hoy.slice(0, 7);
  await ingresar(page, 'admin@demo.pe', '/gastos');
  await nuevoGasto(page, { descripcion, monto: '1200', estado: 'Planificado' });
  await expect(page.getByRole('row', { name: new RegExp(descripcion) })).toContainText('Planificado');

  await page.getByRole('link', { name: 'Planificados', exact: true }).click();
  await expect(page).toHaveURL(/\/gastos\/planificados$/);
  const totalMes = await montoDe(page, `total-mes-${mes}`);
  expect(totalMes.gte(1200)).toBe(true);

  await page.getByRole('button', { name: `Marcar como realizado: ${descripcion}` }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByLabel('Monto real (S/)')).toHaveValue('1200.00');
  await dialogo.getByLabel('Monto real (S/)').fill('1250.40');
  await dialogo.getByLabel('Fecha de pago').fill(hoy);
  await dialogo.getByRole('combobox', { name: 'Método de pago' }).click();
  await page.getByRole('option', { name: 'Efectivo' }).click();
  await dialogo.getByRole('button', { name: 'Marcar como realizado' }).click();
  await expect(page.getByText('Gasto marcado como realizado').first()).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(descripcion) })).toHaveCount(0);

  await page.goto('/gastos?estado=realizado');
  const fila = page.getByRole('row', { name: new RegExp(descripcion) });
  await expect(fila).toContainText('S/ 1 250.40');
  await expect(fila).toContainText('Efectivo');
});

test('M9: el admin edita y borra un gasto', async ({ page }) => {
  const descripcion = `${PREFIJO} flete ${Date.now()}`;
  await ingresar(page, 'admin@demo.pe', '/gastos');
  await nuevoGasto(page, { descripcion, monto: '80' });

  const fila = page.getByRole('row', { name: new RegExp(descripcion) });
  await fila.getByRole('button', { name: `Editar ${descripcion}` }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel(/^Monto/).fill('95.10');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Gasto actualizado').first()).toBeVisible();
  await expect(fila).toContainText('S/ 95.10');

  await fila.getByRole('button', { name: 'Borrar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Borrar' }).click();
  await expect(page.getByText('Gasto borrado').first()).toBeVisible();
  await expect(fila).toHaveCount(0);
});

test('RN-24: el vendedor y el técnico no entran a /gastos ni leen gastos por la API', async ({ page, browser }) => {
  for (const [email, p] of [
    ['vendedor@demo.pe', page],
    ['tecnico@demo.pe', await browser.newPage()],
  ] as const) {
    await ingresar(p, email);
    await expect(p.getByRole('link', { name: 'Gastos', exact: true })).toHaveCount(0);
    await expect(p.getByTestId('utilidad-neta')).toHaveCount(0);
    await p.goto('/gastos');
    await expect(p).toHaveURL(/\/$/);
    await p.goto('/gastos/planificados');
    await expect(p).toHaveURL(/\/$/);

    const supabase = await clienteDemo(email);
    const { data } = await supabase.from('gastos').select('id').limit(1);
    expect(data ?? []).toEqual([]);
    const { data: utilidad } = await supabase.from('v_utilidad_mensual').select('mes').limit(1);
    expect(utilidad ?? []).toEqual([]);
    const { data: archivos } = await supabase.storage.from(BUCKET).list();
    expect(archivos ?? []).toEqual([]);
    await supabase.auth.signOut();
  }
});
