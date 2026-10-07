-- =============================================================================
-- Pruebas de la administración de usuarios (SPEC M1, tarea 4.1)
-- Uso: ./tests/run.sh
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values
  (gen_random_uuid(), 'admin@ev.pe',   '{"nombre":"Ana Admin"}'),
  (gen_random_uuid(), 'admin2@ev.pe',  '{"nombre":"Beto Admin"}'),
  (gen_random_uuid(), 'ventas@ev.pe',  '{"nombre":"Vero Ventas"}'),
  (gen_random_uuid(), 'nuevo@ev.pe',   '{}');
update public.profiles p set rol = x.rol::public.app_role
from (values ('admin@ev.pe','admin'), ('admin2@ev.pe','admin'), ('ventas@ev.pe','vendedor')) x(email, rol)
join auth.users u on u.email = x.email where p.id = u.id;
insert into test.ids select 'nuevo', id from auth.users where email = 'nuevo@ev.pe';
insert into test.ids select 'admin', id from auth.users where email = 'admin@ev.pe';
insert into test.ids select 'admin2', id from auth.users where email = 'admin2@ev.pe';

set role authenticated;

-- ---------------------------------------------------------------- listar_usuarios
select test.como('admin@ev.pe');
do $$ begin
  assert (select count(*) from public.listar_usuarios()) = 4, 'el admin ve los 4 usuarios';
  assert (select email from public.listar_usuarios() where id = test.id('nuevo')) = 'nuevo@ev.pe', 'incluye el email';
  assert (select rol from public.listar_usuarios() where id = test.id('nuevo')) is null, 'el nuevo no tiene rol';
end $$;

select test.como('ventas@ev.pe');
select test.expect_error($$select * from public.listar_usuarios()$$, 'Solo un administrador');
select test.como('nuevo@ev.pe');
select test.expect_error($$select * from public.listar_usuarios()$$, 'Solo un administrador');
reset role;
set role anon;
select test.expect_error($$select * from public.listar_usuarios()$$, 'permission denied');
reset role;
set role authenticated;
\echo '✔ 1. M1: solo el admin lista usuarios con su email'

-- ---------------------------------------------------------------- asignar rol y desactivar
select test.como('admin@ev.pe');
update public.profiles set rol = 'tecnico' where id = test.id('nuevo');
do $$ begin
  assert (select rol from public.profiles where id = test.id('nuevo')) = 'tecnico', 'el admin asigna rol';
end $$;
update public.profiles set activo = false where id = test.id('nuevo');
select test.como('nuevo@ev.pe');
do $$ begin
  assert public.current_app_role() is null, 'una cuenta desactivada no tiene rol efectivo';
  assert (select count(*) from public.vehicle_models) = 0 and not public.is_staff(), 'y no ve nada';
end $$;

-- Un no-admin no puede darse rol (regla existente, sigue vigente)
select test.expect_error($$update public.profiles set rol = 'admin' where id = auth.uid()$$, 'Solo un administrador');
\echo '✔ 2. M1: el admin asigna roles y desactiva cuentas; una cuenta desactivada no ve nada'

-- ---------------------------------------------------------------- un admin no se bloquea a sí mismo
select test.como('admin@ev.pe');
select test.expect_error($$update public.profiles set rol = 'vendedor' where id = auth.uid()$$, 'No puedes quitarte tu propio rol');
select test.expect_error($$update public.profiles set rol = null where id = auth.uid()$$, 'No puedes quitarte tu propio rol');
select test.expect_error($$update public.profiles set activo = false where id = auth.uid()$$, 'desactivar tu cuenta');
-- Sí puede editar su nombre
update public.profiles set nombre = 'Ana A.' where id = auth.uid();
-- Y otro admin sí puede quitarle el rol
select test.como('admin2@ev.pe');
update public.profiles set rol = 'vendedor' where id = test.id('admin');
do $$ begin
  assert (select rol from public.profiles where id = test.id('admin')) = 'vendedor', 'otro admin puede cambiarle el rol';
end $$;
\echo '✔ 3. D19: un admin no se quita su propio rol ni se desactiva; otro admin sí puede'
\echo ''
\echo 'TODAS LAS PRUEBAS DE admin_usuarios PASARON'
