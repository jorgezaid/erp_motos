// SOLO LOCAL — carga usuarios demo con contraseñas conocidas (D29).
// 1) `supabase db reset` (migraciones, incluidos los datos base; borra la BD local)
// 2) carga supabase/demo/*.sql en la BD LOCAL con el psql del contenedor de `supabase start`
//    (igual que tests/run.ps1). Nunca se conecta a otra BD: si no encuentra el contenedor local, se detiene.
// Uso: pnpm db:demo
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

function ejecutar(comando, args, { capturar = false } = {}) {
  const r = spawnSync(comando, args, { encoding: 'utf8', stdio: capturar ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
  if (r.error) {
    console.error(`No se pudo ejecutar ${comando}: ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`Falló: ${comando} ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
  return r.stdout ?? '';
}

const carpeta = join('supabase', 'demo');
const archivos = readdirSync(carpeta).filter((f) => f.endsWith('.sql')).sort();
if (archivos.length === 0) {
  console.error(`No hay archivos .sql en ${carpeta}`);
  process.exit(1);
}

console.log('→ supabase db reset (BD local)');
ejecutar('supabase', ['db', 'reset']);

const contenedor = ejecutar('docker', ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'], { capturar: true })
  .split(/\r?\n/)
  .find(Boolean);
if (!contenedor) {
  console.error('No se encontró el contenedor supabase_db_* de la BD local. Ejecuta primero: supabase start');
  process.exit(1);
}

const destino = '/tmp/erp_demo';
ejecutar('docker', ['exec', contenedor, 'rm', '-rf', destino]);
// docker cp en vez de un pipe: así no se dañan los acentos (UTF-8) en Windows
ejecutar('docker', ['cp', carpeta, `${contenedor}:${destino}`]);
for (const archivo of archivos) {
  console.log(`→ ${archivo}`);
  ejecutar('docker', [
    'exec',
    '-e',
    'PGPASSWORD=postgres',
    contenedor,
    'psql',
    '-h',
    '127.0.0.1',
    '-p',
    '5432',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-q',
    '-o',
    '/dev/null',
    '-f',
    `${destino}/${archivo}`,
  ]);
}
ejecutar('docker', ['exec', contenedor, 'rm', '-rf', destino]);
console.log(`Datos demo cargados en la BD local (${contenedor}). Usuarios: *@demo.pe / Demo1234!`);
