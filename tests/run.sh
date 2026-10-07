#!/usr/bin/env bash
# Por cada tests/test_*.sql: crea una BD limpia, aplica shim + migraciones + seed
# + helpers y corre ese archivo. Así los archivos no dependen entre sí.
set -euo pipefail
cd "$(dirname "$0")/.."
# Por defecto apunta a la BD local de Supabase (`supabase start`, puerto 44322).
# Crea y usa una BD aparte (ev_erp_test): no toca tu BD de desarrollo.
export PGPASSWORD="${PGPASSWORD:-postgres}"
PSQL="psql -h ${PGHOST:-127.0.0.1} -p ${PGPORT:-44322} -U ${PGUSER:-postgres} -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -c "do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  end if; end \$\$"

preparar_bd() {
  $PSQL -d postgres -c "drop database if exists ev_erp_test" -c "create database ev_erp_test"
  sed '/^create role/d' tests/00_supabase_shim.sql | $PSQL -d ev_erp_test
  for f in supabase/migrations/*.sql supabase/seed.sql tests/01_helpers.sql; do
    $PSQL -d ev_erp_test -f "$f"
  done
}

for t in tests/test_*.sql; do
  echo "══ $t (BD limpia)"
  preparar_bd
  $PSQL -d ev_erp_test -f "$t"
done
echo ""
echo "TODOS LOS ARCHIVOS DE PRUEBAS PASARON"
