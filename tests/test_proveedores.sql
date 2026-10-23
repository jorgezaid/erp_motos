-- =============================================================================
-- Pruebas de proveedores (D41, 17.1): solo admin; el importador enlaza o crea el proveedor por
-- nombre; un lote liquidado admite cambiar SOLO proveedor_id (y las notas, como antes).
-- Uso: ./tests/run.sh
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values
  (gen_random_uuid(), 'admin@ev.pe', '{"nombre":"Ana"}'),
  (gen_random_uuid(), 'tecnico@ev.pe', '{"nombre":"Tito"}'),
  (gen_random_uuid(), 'vendedor@ev.pe', '{"nombre":"Vico"}');
update public.profiles p set rol = x.rol::public.app_role
from (values ('admin@ev.pe','admin'), ('tecnico@ev.pe','tecnico'), ('vendedor@ev.pe','vendedor')) x(email, rol)
join auth.users u on u.email = x.email where p.id = u.id;

insert into test.ids select email, id from auth.users;

set role authenticated;
select test.como('admin@ev.pe');

do $$ begin
  assert (select count(*) from public.proveedores where nombre = 'Tianjin Newspeed Cycle Co., Ltd.') = 1, 'Tianjin creado';
end $$;
\echo '✔ 1. «Tianjin Newspeed Cycle Co., Ltd.» queda como proveedor'

-- ---------------------------------------------------------------- 2. Alta y unicidad
insert into public.proveedores (nombre, ruc, telefono) values ('Luna Importaciones', '20123456789', '987654321');
insert into test.ids select 'luna', id from public.proveedores where nombre = 'Luna Importaciones';
select test.expect_error($$insert into public.proveedores (nombre) values ('  luna importaciones ')$$, 'duplicate');
select test.expect_error($$insert into public.proveedores (nombre, ruc) values ('Otro', '20123456789')$$, 'duplicate');
select test.expect_error($$insert into public.proveedores (nombre, ruc) values ('Otro', '2012345')$$, 'check');
\echo '✔ 2. Nombre (sin distinguir mayúsculas) y RUC únicos; RUC de 11 dígitos'

-- ---------------------------------------------------------------- 3. Solo admin
select test.como('vendedor@ev.pe');
do $$ begin assert (select count(*) from public.proveedores) = 0, 'vendedor no ve proveedores'; end $$;
select test.expect_error($$insert into public.proveedores (nombre) values ('X')$$, 'row-level security');
select test.como('tecnico@ev.pe');
do $$ begin assert (select count(*) from public.proveedores) = 0, 'técnico no ve proveedores'; end $$;
reset role;
set role anon;
select test.expect_error($$select count(*) from public.proveedores$$, 'permission denied');
reset role;
set role authenticated;
\echo '✔ 3. Vendedor, técnico y anon no ven ni crean proveedores'

-- ---------------------------------------------------------------- 4. El texto del importador
select test.como('admin@ev.pe');
insert into public.import_batches (codigo_embarque, proveedor, tipo_cambio) values ('PV-1', ' LUNA importaciones', 3.5);
insert into public.import_batches (codigo_embarque, proveedor, tipo_cambio) values ('PV-2', 'Proveedor Nuevo', 3.5);
insert into test.ids select codigo_embarque, id from public.import_batches;
do $$ begin
  assert (select proveedor_id from public.import_batches where codigo_embarque = 'PV-1') = test.id('luna'), 'enlaza por nombre';
  assert (select p.nombre from public.import_batches b join public.proveedores p on p.id = b.proveedor_id
          where b.codigo_embarque = 'PV-2') = 'Proveedor Nuevo', 'crea el proveedor';
end $$;
\echo '✔ 4. Si el importador escribe el nombre, se enlaza el proveedor existente o se crea'

-- ---------------------------------------------------------------- 5. Lote liquidado
reset role;
set session_replication_role = replica;
update public.import_batches set estado = 'liquidado' where codigo_embarque = 'PV-2';
set session_replication_role = default;
set role authenticated;
select test.como('admin@ev.pe');

update public.import_batches set proveedor_id = test.id('luna') where id = test.id('PV-2');
update public.import_batches set notas = 'nota' where id = test.id('PV-2');
do $$ begin
  assert (select proveedor_id = test.id('luna') and notas = 'nota' and proveedor = 'Proveedor Nuevo'
          from public.import_batches where id = test.id('PV-2')), 'proveedor_id y notas cambian; el texto no';
end $$;
select test.expect_error($$update public.import_batches set proveedor = 'Luna Importaciones' where id = test.id('PV-2')$$, 'liquidado');
select test.expect_error($$update public.import_batches set tipo_cambio = 3.9 where id = test.id('PV-2')$$, 'liquidado');
select test.expect_error($$update public.import_batches set nro_dam = '118-2026-10-361056-01-0-00' where id = test.id('PV-2')$$, 'liquidado');
select test.expect_error($$update public.import_batches set proveedor_id = test.id('luna'), flete_nacional_pen = 1
  where id = test.id('PV-2')$$, 'liquidado');
\echo '✔ 5. D41: un lote liquidado admite cambiar solo proveedor_id (y las notas); ninguna otra columna'

\echo 'TODAS LAS PRUEBAS DE proveedores PASARON'
