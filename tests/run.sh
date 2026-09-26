#!/usr/bin/env bash
# Crea una BD limpia, aplica shim + migraciones + seed y corre las pruebas.
set -euo pipefail
cd "$(dirname "$0")/.."
# Por defecto apunta a la BD local de Supabase (`supabase start`, puerto 54322).
# Crea y usa una BD aparte (ev_erp_test): no toca tu BD de desarrollo.
export PGPASSWORD="${PGPASSWORD:-postgres}"
PSQL="psql -h ${PGHOST:-127.0.0.1} -p ${PGPORT:-54322} -U ${PGUSER:-postgres} -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -c "drop database if exists ev_erp_test" -c "create database ev_erp_test"
$PSQL -d postgres -c "do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  end if; end \$\$"
sed '/^create role/d' tests/00_supabase_shim.sql | $PSQL -d ev_erp_test
for f in supabase/migrations/*.sql supabase/seed.sql; do
  echo "→ $f"; $PSQL -d ev_erp_test -f "$f"
done
echo "→ pruebas"
$PSQL -d ev_erp_test -f tests/test_reglas_negocio.sql
