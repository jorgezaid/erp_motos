# Equivalente de tests/run.sh para Windows sin psql local.
# Copia migraciones, seed y pruebas al contenedor de la BD de Supabase (`supabase start`)
# y ejecuta el propio tests/run.sh DENTRO del contenedor, con su psql.
# Crea y usa una BD aparte (ev_erp_test): no toca tu BD de desarrollo.
# Uso: .\tests\run.ps1     (desde cualquier carpeta)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$pgUser = if ($env:PGUSER) { $env:PGUSER } else { 'postgres' }
$pgPass = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { 'postgres' }

$container = docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | Select-Object -First 1
if (-not $container) {
    Write-Error 'No se encontró el contenedor supabase_db_*. Ejecuta primero: supabase start'
}
Write-Host "→ contenedor $container"

# docker cp en vez de un pipe: PowerShell 5.1 puede dañar los acentos (UTF-8) al pasar texto a docker.
$dest = '/tmp/erp_tests'
docker exec $container rm -rf $dest
docker exec $container mkdir -p "$dest/supabase"
docker cp "$root\supabase\migrations" "${container}:$dest/supabase/migrations"
docker cp "$root\supabase\seed.sql"   "${container}:$dest/supabase/seed.sql"
docker cp "$root\tests"               "${container}:$dest/tests"
if ($LASTEXITCODE -ne 0) { Write-Error 'Falló docker cp' }

# Dentro del contenedor Postgres escucha en 5432 (54322 es el puerto publicado en Windows).
docker exec -e PGHOST=127.0.0.1 -e PGPORT=5432 -e PGUSER=$pgUser -e PGPASSWORD=$pgPass `
    $container bash "$dest/tests/run.sh"
$code = $LASTEXITCODE
docker exec $container rm -rf $dest | Out-Null
exit $code
