import { expect, test, type Page } from '@playwright/test';
import { hoja, plantillaDeEjemplo, vinsDeEjemplo } from '../src/lib/importar/ejemplo';
import { ingresar } from './ayudas';

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function subir(page: Page, buffer: Buffer) {
  await page.getByLabel('Archivo de la plantilla (.xlsx)').setInputFiles({ name: 'plantilla-llena.xlsx', mimeType: MIME_XLSX, buffer });
  await page.getByRole('button', { name: 'Importar Excel' }).click();
  await expect(page.getByText('2. Revisa qué se va a guardar')).toBeVisible();
}

test('D33: el admin sube la plantilla, ve los errores, la corrige, confirma y ve las unidades en Inventario', async ({ page }) => {
  const sufijo = Date.now().toString(36).toUpperCase();
  const codigoLote = `IMP${sufijo}`;
  const [vinA] = vinsDeEjemplo(sufijo);

  await ingresar(page, 'admin@demo.pe');
  await page.getByRole('link', { name: 'Importar Excel' }).click();
  await expect(page).toHaveURL(/\/admin\/importar$/);

  // 1. Con errores: Situación no soportada y un VIN repetido → no se puede confirmar
  const conErrores = await plantillaDeEjemplo({
    codigoLote,
    sufijo,
    modificar: (wb) => {
      hoja(wb, 'Unidades').getCell('F4').value = 'vendida';
      hoja(wb, 'Unidades').getCell('A5').value = vinA;
    },
  });
  await subir(page, conErrores);
  const errores = page.getByRole('table', { name: 'Errores de la plantilla' });
  await expect(errores.getByRole('row', { name: /Unidades 4 Situación «vendida»: no soportado todavía/ })).toBeVisible();
  await expect(errores.getByRole('row', { name: new RegExp(`Unidades 5 VIN ${vinA} repetido \\(también en la fila 3\\)`) })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar' })).toBeDisabled();

  // 2. Corregido: resumen por hoja, usuarios para Supabase y confirmar
  await subir(page, await plantillaDeEjemplo({ codigoLote, sufijo }));
  await expect(page.getByText(`Lote ${codigoLote} (nuevo)`)).toBeVisible();
  await expect(page.getByTestId('resumen-Unidades')).toContainText('Unidades30Entran en caja');
  await expect(page.getByTestId('resumen-Baterías (opcional)')).toContainText('40');
  await expect(page.getByRole('cell', { name: 'rosa.quispe@empresa.pe' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Importación guardada', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('resultado-importacion')).toContainText('Unidades: 3 creadas (en caja)');

  // 3. Reimportar el mismo archivo no duplica
  await subir(page, await plantillaDeEjemplo({ codigoLote, sufijo }));
  await expect(page.getByText(`Lote ${codigoLote} (ya existe: se actualiza)`)).toBeVisible();
  await expect(page.getByTestId('resumen-Unidades')).toContainText('Unidades03');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByTestId('resultado-importacion')).toContainText('Unidades: 0 creadas (en caja), 0 actualizadas');

  // 4. Las unidades están en Inventario, en caja
  await page.goto(`/inventario?q=V${sufijo}`);
  await expect(page.getByText('Mostrando 1–3 de 3')).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(vinA) })).toContainText('Rojo / Negro');
  await expect(page.getByRole('row', { name: new RegExp(vinA) })).toContainText('En caja');
});

test('D33: el técnico y el vendedor no ven ni abren el importador', async ({ page }) => {
  for (const email of ['tecnico@demo.pe', 'vendedor@demo.pe']) {
    await ingresar(page, email);
    await expect(page.getByRole('link', { name: 'Importar Excel' })).toHaveCount(0);
    await page.goto('/admin/importar');
    await expect(page).not.toHaveURL(/\/admin\/importar/);
    await page.context().clearCookies();
  }
});
