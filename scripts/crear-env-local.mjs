// Crea .env.local con la URL y la clave anónima de la Supabase LOCAL (`supabase start`).
// Solo escribe valores públicos (los que llegan al navegador); nunca la service_role key.
// Uso: pnpm env:local
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

if (existsSync('.env.local') && !process.argv.includes('--forzar')) {
  console.log('.env.local ya existe; no se modifica (usa --forzar para regenerarlo).');
  process.exit(0);
}

const salida = execSync('supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const valores = Object.fromEntries(
  salida
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

if (!valores.API_URL || !valores.ANON_KEY) {
  console.error('No se pudo leer API_URL y ANON_KEY de `supabase status`. ¿Ejecutaste `supabase start`?');
  process.exit(1);
}

writeFileSync(
  '.env.local',
  [
    '# Generado por scripts/crear-env-local.mjs (Supabase local). No subir a git.',
    `NEXT_PUBLIC_SUPABASE_URL=${valores.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${valores.ANON_KEY}`,
    '',
  ].join('\n'),
);
console.log('.env.local creado con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.');
