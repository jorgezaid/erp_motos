-- =============================================================================
-- Permisos de los roles de la API (D30)
-- En Supabase Cloud los proyectos nuevos no dan grants por defecto en `public`: `authenticated`
-- y `service_role` no tenían SELECT/INSERT/UPDATE/DELETE y la app no podía leer nada.
-- Aquí se dan explícitamente (el acceso real lo sigue decidiendo el RLS). Nada para `anon`.
-- Idempotente: los GRANT y ALTER DEFAULT PRIVILEGES se pueden repetir sin efecto.
-- =============================================================================

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Objetos que se creen en el futuro (como `postgres`, el dueño de las migraciones)
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to authenticated, service_role;
