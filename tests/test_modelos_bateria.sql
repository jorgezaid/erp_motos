-- =============================================================================
-- Pruebas de modelos (D41, 17.2): EXW/CBM opcionales salvo en la línea de una importación,
-- tiene_techo, batería de litio con su cantidad y la regla de baterías completas (RN-10).
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

-- ---------------------------------------------------------------- 1. Plomo: igual que antes
insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('MB-60', 'bicimoto', 60, 20, 800, 0.6, 300);
do $$ begin
  assert (select cantidad_baterias_12v = 5 and tipo_bateria = 'plomo_12v' and not tiene_techo
          from public.vehicle_models where codigo_modelo = 'MB-60'), 'plomo 60V → 5';
end $$;
-- Escrita a mano no cuenta: el trigger la recalcula
update public.vehicle_models set cantidad_baterias_12v = 3 where codigo_modelo = 'MB-60';
do $$ begin
  assert (select cantidad_baterias_12v from public.vehicle_models where codigo_modelo = 'MB-60') = 5, 'sigue en 5';
end $$;
-- Y aunque se salte el trigger, el CHECK exige la fórmula
reset role;
set session_replication_role = replica;
select test.expect_error($$update public.vehicle_models set cantidad_baterias_12v = 3 where codigo_modelo = 'MB-60'$$,
  'vehicle_models_cantidad_baterias_check');
set session_replication_role = default;
set role authenticated;
select test.como('admin@ev.pe');
update public.vehicle_models set voltaje_sistema = 72 where codigo_modelo = 'MB-60';
do $$ begin
  assert (select cantidad_baterias_12v from public.vehicle_models where codigo_modelo = 'MB-60') = 6, 'se recalcula: 72V → 6';
end $$;
\echo '✔ 1. RN-01: plomo 12V sigue en voltaje / 12 y la cantidad no se escribe a mano'

-- ---------------------------------------------------------------- 2. Litio, techo y sin EXW/CBM
insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, tipo_bateria, baterias_litio, tiene_techo)
values ('LUNA-T', 'trimoto_pasajeros', 60, 50, 1000, 'litio', 1, true);
do $$ begin
  assert (select cantidad_baterias_12v = 1 and tiene_techo and exw_usd_unitario is null and volumen_cbm_unitario is null
          from public.vehicle_models where codigo_modelo = 'LUNA-T'), 'litio 1 batería, techo, sin EXW/CBM';
end $$;
select test.expect_error($$insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
  potencia_motor_watts, tipo_bateria) values ('X1', 'bicimoto', 48, 20, 500, 'litio')$$, 'Indica cuántas baterías de litio');
select test.expect_error($$insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
  potencia_motor_watts, baterias_litio) values ('X2', 'bicimoto', 48, 20, 500, 2)$$, 'vehicle_models_tipo_bateria_check');
select test.expect_error($$insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
  potencia_motor_watts, tipo_bateria, baterias_litio) values ('X3', 'bicimoto', 64, 20, 500, 'litio', 1)$$, 'voltaje_sistema_check');
\echo '✔ 2. D41: litio con su cantidad (1 a 6), techo y sin EXW/CBM; el voltaje sigue en 48/60/72'

-- ---------------------------------------------------------------- 3. Línea de importación
insert into public.import_batches (codigo_embarque, tipo_cambio) values ('MB-LOTE', 3.78);
insert into test.ids select 'lote', id from public.import_batches;
insert into test.ids select codigo_modelo, id from public.vehicle_models;
select test.expect_error($$insert into public.batch_items (batch_id, model_id, cantidad_packing_list)
  select test.id('lote'), test.id('LUNA-T'), 2$$, 'El modelo LUNA-T no tiene EXW/CBM');
insert into public.batch_items (batch_id, model_id, cantidad_packing_list, exw_usd_unitario, volumen_cbm_unitario)
values (test.id('lote'), test.id('LUNA-T'), 2, 500, 1.2);
\echo '✔ 3. D41: en un lote de importación la línea exige EXW y CBM'

-- ---------------------------------------------------------------- 4. RN-10 con litio
insert into public.locations (nombre, tipo) values ('MB Showroom', 'showroom');
insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor, estado)
values (test.id('lote'), test.id('LUNA-T'), 'VINLITIO', 'MOTLITIO', 'en_caja');
insert into test.ids select vin_chasis, id from public.vehicle_inventory;
update public.vehicle_inventory set estado = 'en_ensamble' where id = test.id('VINLITIO');
insert into public.vehicle_batteries (vehicle_id, serial, posicion) values (test.id('VINLITIO'), 'LI-001', 1);
select test.expect_error($$insert into public.vehicle_batteries (vehicle_id, serial, posicion)
  values (test.id('VINLITIO'), 'LI-002', 2)$$, '1 batería');
insert into public.technical_inspections (vehicle_id, baterias_esperadas, baterias_contadas, vin_verificado, motor_verificado)
values (test.id('VINLITIO'), 99, 1, true, true);
update public.vehicle_inventory set estado = 'listo_en_tienda', location_id = (select id from public.locations where nombre = 'MB Showroom')
where id = test.id('VINLITIO');
do $$ begin
  assert (select estado from public.vehicle_inventory where id = test.id('VINLITIO')) = 'listo_en_tienda', 'en tienda con 1 batería';
end $$;
\echo '✔ 4. RN-10: una moto de litio pasa a tienda con su batería e inspección aprobada'

-- ---------------------------------------------------------------- 5. No cambiar con baterías registradas
select test.expect_error($$update public.vehicle_models set baterias_litio = 2 where codigo_modelo = 'LUNA-T'$$,
  'ya tiene baterías registradas');
select test.expect_error($$update public.vehicle_models set tipo_bateria = 'plomo_12v', baterias_litio = null
  where codigo_modelo = 'LUNA-T'$$, 'ya tiene baterías registradas');
update public.vehicle_models set tiene_techo = false, nombre_comercial = 'Luna T' where codigo_modelo = 'LUNA-T';
\echo '✔ 5. D41: con baterías registradas no cambia la cantidad esperada (el resto del modelo sí)'

\echo 'TODAS LAS PRUEBAS DE modelos_bateria PASARON'
