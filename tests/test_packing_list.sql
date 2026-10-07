-- =============================================================================
-- Pruebas del packing list (RN-04 al editar, D23)
-- Uso: ./tests/run.sh
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values
  (gen_random_uuid(), 'admin@ev.pe', '{"nombre":"Ana"}'),
  (gen_random_uuid(), 'tecnico@ev.pe', '{"nombre":"Tito"}');
update public.profiles p set rol = x.rol::public.app_role
from (values ('admin@ev.pe','admin'), ('tecnico@ev.pe','tecnico')) x(email, rol)
join auth.users u on u.email = x.email where p.id = u.id;

set role authenticated;
select test.como('admin@ev.pe');

insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('TEST-48', 'bicimoto', 48, 20, 500, 0.50, 300), ('TEST-60', 'bicimoto', 60, 20, 800, 0.80, 500);
insert into public.import_batches (codigo_embarque) values ('LOTE-PL');
insert into test.ids select 'lote', id from public.import_batches;
insert into test.ids select 'm48', id from public.vehicle_models where codigo_modelo = 'TEST-48';
insert into test.ids select 'm60', id from public.vehicle_models where codigo_modelo = 'TEST-60';

-- EXW y CBM se precargan del catálogo (trigger existente) y son editables
insert into public.batch_items (batch_id, model_id, cantidad_packing_list) values (test.id('lote'), test.id('m48'), 3);
insert into public.batch_items (batch_id, model_id, cantidad_packing_list, exw_usd_unitario, volumen_cbm_unitario)
values (test.id('lote'), test.id('m60'), 2, 480, 0.75);
do $$ begin
  assert (select exw_usd_unitario from public.batch_items where model_id = test.id('m48')) = 300, 'EXW del catálogo';
  assert (select volumen_cbm_unitario from public.batch_items where model_id = test.id('m60')) = 0.75, 'CBM editado';
end $$;
\echo '✔ 1. M3: EXW y CBM se precargan del catálogo y se pueden ajustar'

-- Registra 2 unidades de TEST-48
select test.como('tecnico@ev.pe');
insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor)
values (test.id('lote'), test.id('m48'), 'VIN-PL-1', 'MOT-PL-1'), (test.id('lote'), test.id('m48'), 'VIN-PL-2', 'MOT-PL-2');

select test.como('admin@ev.pe');
select test.expect_error($$update public.batch_items set cantidad_packing_list = 1 where model_id = test.id('m48')$$,
  'TEST-48 ya tiene 2 unidad(es) registradas');
update public.batch_items set cantidad_packing_list = 2 where model_id = test.id('m48');   -- igual a las registradas: ok
update public.batch_items set cantidad_packing_list = 5 where model_id = test.id('m48');   -- subir: ok
select test.expect_error($$delete from public.batch_items where model_id = test.id('m48')$$, 'foreign key');
delete from public.batch_items where model_id = test.id('m60');                            -- sin unidades: ok
\echo '✔ 2. D23/RN-04: la cantidad no baja de las unidades registradas; una línea con unidades no se quita'

select test.expect_error($$update public.batch_items set model_id = test.id('m60') where model_id = test.id('m48')$$,
  'No se puede cambiar el modelo');
\echo '✔ 3. D23: el modelo de una línea no se cambia'
\echo ''
\echo 'TODAS LAS PRUEBAS DE packing_list PASARON'
