import { expect, type Page } from '@playwright/test';

export const PASSWORD_DEMO = 'Demo1234!';

/** Abre una pestaña de /lotes/[id] (sin confundirla con los enlaces del sidebar). */
export async function pestanaLote(page: Page, nombre: string) {
  await page.getByRole('navigation', { name: 'Secciones del lote' }).getByRole('link', { name: nombre, exact: true }).click();
}

/** Inicia sesión con un usuario de supabase/seeds/01_usuarios_demo.sql */
export async function ingresar(page: Page, email: string, destino = '/') {
  await page.goto(`/login${destino === '/' ? '' : `?next=${encodeURIComponent(destino)}`}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD_DEMO);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
