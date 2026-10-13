-- =============================================================================
-- Pruebas de permisos de los roles de la API (D30, migración grants_roles_api)
-- Uso: ./tests/run.sh
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

-- ------------------------------------------------ todas las tablas de public tienen RLS
do $$ declare v_sin_rls text; begin
  select string_agg(c.relname, ', ' order by c.relname) into v_sin_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  assert v_sin_rls is null, 'tablas de public sin RLS: ' || v_sin_rls;
end $$;

-- ------------------------------------------------ anon no tiene acceso a nada de public
do $$ declare v_objetos text; begin
  -- tablas, vistas, vistas materializadas y tablas foráneas
  select string_agg(c.relname, ', ' order by c.relname) into v_objetos
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER');
  assert v_objetos is null, 'anon tiene permisos sobre: ' || v_objetos;

  select string_agg(c.relname, ', ' order by c.relname) into v_objetos
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    -- case: el planificador podría evaluar has_sequence_privilege antes del filtro por relkind
    and case when c.relkind = 'S' then has_sequence_privilege('anon', c.oid, 'USAGE, SELECT, UPDATE') else false end;
  assert v_objetos is null, 'anon tiene permisos sobre las secuencias: ' || v_objetos;

  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text) into v_objetos
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE');
  assert v_objetos is null, 'anon puede ejecutar: ' || v_objetos;
end $$;

-- ------------------------------------------------ authenticated sí tiene los grants (el RLS decide)
do $$ declare v_objetos text; begin
  select string_agg(c.relname, ', ' order by c.relname) into v_objetos
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    -- has_table_privilege con varios privilegios es "alguno": se exigen los cuatro por separado
    and not (has_table_privilege('authenticated', c.oid, 'SELECT')
         and has_table_privilege('authenticated', c.oid, 'INSERT')
         and has_table_privilege('authenticated', c.oid, 'UPDATE')
         and has_table_privilege('authenticated', c.oid, 'DELETE'));
  assert v_objetos is null, 'a authenticated le faltan permisos en: ' || v_objetos;
end $$;

-- ------------------------------------------------ authenticated y service_role conservan EXECUTE
do $$ declare v_objetos text; begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text) into v_objetos
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not (has_function_privilege('authenticated', p.oid, 'EXECUTE')
         and has_function_privilege('service_role', p.oid, 'EXECUTE'));
  assert v_objetos is null, 'authenticated o service_role no pueden ejecutar: ' || v_objetos;
  -- las que usan las políticas RLS, por nombre
  assert has_function_privilege('authenticated', 'public.is_staff()', 'EXECUTE'), 'is_staff';
  assert has_function_privilege('authenticated', 'public.can_edit_order(uuid)', 'EXECUTE'), 'can_edit_order';
  assert has_function_privilege('authenticated', 'public.has_role(public.app_role[])', 'EXECUTE'), 'has_role';
end $$;

-- ------------------------------------------------ el alta en Auth sigue creando el perfil
-- Simula supabase_auth_admin: un rol sin superusuario ni EXECUTE sobre handle_new_user
-- Los roles son del clúster (no de la BD de prueba): se crea solo si una corrida anterior lo dejó
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'test_auth_admin') then
    create role test_auth_admin nologin;
  end if;
end $$;
grant test_auth_admin to current_user;  -- PG 16+: necesario para `set role`
grant usage on schema auth to test_auth_admin;
grant insert on auth.users to test_auth_admin;
do $$ begin
  assert not has_function_privilege('test_auth_admin', 'public.handle_new_user()', 'EXECUTE'),
    'el rol de prueba no debe tener EXECUTE directo';
end $$;
set role test_auth_admin;
insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-0000000000a1', 'alta@ev.pe', '{"nombre":"Alta Auth"}');
reset role;
do $$ begin
  assert (select nombre from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') = 'Alta Auth',
    'handle_new_user crea el perfil';
  assert (select rol from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') is null,
    'el usuario nuevo no tiene rol (D6)';
end $$;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
drop owned by test_auth_admin;
drop role test_auth_admin;

-- ------------------------------------------------ en la práctica: anon recibe "permission denied"
set role anon;
select test.expect_error('select * from public.vehicle_inventory', 'permission denied');
select test.expect_error('select * from public.import_batches', 'permission denied');
select test.expect_error('select * from public.v_stock', 'permission denied');
select test.expect_error($q$insert into public.locations (nombre, tipo) values ('X', 'almacen')$q$, 'permission denied');
select test.expect_error('select public.is_staff()', 'permission denied');
reset role;

\o
\echo '✔ D30: RLS en todas las tablas; anon sin acceso a tablas, secuencias ni funciones'
\echo '✔ D30: authenticated y service_role con grants y EXECUTE; el alta en Auth crea el perfil'
