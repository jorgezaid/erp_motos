import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';

export const PASSWORD_DEMO = 'Demo1234!';

type TipoVenta = Database['public']['Enums']['sale_type'];

/**
 * D31: activa o desactiva escalas de venta como el admin demo (su JWT y RLS, sin service_role).
 * Las pruebas de x3/x6 las activan y las vuelven a desactivar en afterEach, para que queden
 * desactivadas (como en la BD recién creada) aunque la prueba falle.
 */
export async function fijarEscalas(tipos: TipoVenta[], activo: boolean) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) process.loadEnvFile('.env.local');
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey } = process.env;
  if (!url || !anonKey) throw new Error('fijarEscalas: falta .env.local (ejecuta `pnpm env:local`)');
  const supabase = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: errorLogin } = await supabase.auth.signInWithPassword({ email: 'admin@demo.pe', password: PASSWORD_DEMO });
  if (errorLogin) throw new Error(`fijarEscalas: ${errorLogin.message}`);
  const { data, error } = await supabase.from('price_margins').update({ activo }).in('tipo_venta', tipos).select('tipo_venta');
  if (error) throw new Error(`fijarEscalas: ${error.message}`);
  expect(data, 'RLS filtra en silencio: deben cambiar todas las escalas pedidas').toHaveLength(tipos.length);
  await supabase.auth.signOut();
}

export const ESCALAS_MAYORISTAS: TipoVenta[] = ['mayorista_x3', 'distribuidor_x6'];

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
