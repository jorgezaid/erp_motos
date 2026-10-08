import { defineConfig, devices } from '@playwright/test';

// E2E contra la Supabase LOCAL (`supabase start` + `pnpm db:demo`, que carga los usuarios y datos demo).
// Uso: pnpm e2e   (compila y levanta `next start` en el puerto 3100)
const PUERTO = 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next start -p ${PUERTO}`,
    url: `http://127.0.0.1:${PUERTO}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
