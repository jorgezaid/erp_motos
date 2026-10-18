-- =============================================================================
-- Pruebas de la RPC listo_rapido (tarea 13.1, D37): admin y técnico, mismos pasos que el flujo
-- normal (RN-02, RN-10, RN-11 siguen activas), seriales PROV- si faltan, todo o nada.
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

-- Una moto para p_unidades: {vehicle_id, seriales}
create function test.unidad(p_vin text, p_seriales jsonb default '[]') returns jsonb language sql stable as $$
  select jsonb_build_object('vehicle_id', test.id(p_vin), 'seriales', p_seriales)
$$;
grant execute on function test.unidad(text, jsonb) to authenticated;

set role authenticated;
select test.como('admin@ev.pe');

insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('LR-48', 'bicimoto', 48, 20, 500, 0.5, 300),
       ('LR-60', 'trimoto_pasajeros', 60, 32, 1000, 1.2, 650),
       ('LR-72', 'trimoto_carga', 72, 32, 1200, 2.0, 900);
insert into public.import_batches (codigo_embarque, tipo_cambio) values ('LR-LOTE', 3.78);
insert into test.ids select 'lote', id from public.import_batches where codigo_embarque = 'LR-LOTE';
insert into test.ids select codigo_modelo, id from public.vehicle_models;
insert into test.ids select 'showroom', id from public.locations where nombre = 'Showroom Piérola';
insert into public.batch_items (batch_id, model_id, cantidad_packing_list)
values (test.id('lote'), test.id('LR-48'), 4), (test.id('lote'), test.id('LR-60'), 2), (test.id('lote'), test.id('LR-72'), 2);

insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor) values
  (test.id('lote'), test.id('LR-48'), 'VIN48A', 'MOT48A'),
  (test.id('lote'), test.id('LR-48'), 'VIN48B', 'MOT48B'),
  (test.id('lote'), test.id('LR-48'), 'VIN48C', 'MOT48C'),
  (test.id('lote'), test.id('LR-60'), 'VIN60A', 'MOT60A'),
  (test.id('lote'), test.id('LR-72'), 'VIN72A', 'MOT72A'),
  (test.id('lote'), test.id('LR-72'), 'VIN72B', 'MOT72B');
insert into test.ids select vin_chasis, id from public.vehicle_inventory;

-- VIN72A ya está en ensamble con 2 baterías (posiciones 1 y 3)
update public.vehicle_inventory set estado = 'en_ensamble' where id = test.id('VIN72A');
insert into public.vehicle_batteries (vehicle_id, posicion, serial)
values (test.id('VIN72A'), 1, 'REAL72-1'), (test.id('VIN72A'), 3, 'REAL72-3');

-- ---------------------------------------------------------------- 1. Permisos
select test.como('vendedor@ev.pe');
select test.expect_error($$select public.listo_rapido(jsonb_build_array(test.unidad('VIN48A')), test.id('showroom'))$$,
  'Solo un administrador o un técnico');
reset role;
set role anon;
select test.expect_error($$select public.listo_rapido('[]'::jsonb, null)$$, 'permission denied');
reset role;
do $$ begin
  assert not has_function_privilege('anon', 'public.listo_rapido(jsonb, uuid)', 'execute'), 'anon sin EXECUTE';
  assert has_function_privilege('authenticated', 'public.listo_rapido(jsonb, uuid)', 'execute'), 'authenticated con EXECUTE';
  assert (select prosecdef from pg_proc where oid = 'public.listo_rapido(jsonb, uuid)'::regprocedure) = false,
    'security invoker';
end $$;
set role authenticated;
select test.como('tecnico@ev.pe');
select test.expect_error($$select public.listo_rapido('[]'::jsonb, test.id('showroom'))$$, 'Elige al menos una moto');
select test.expect_error($$select public.listo_rapido(jsonb_build_array(test.unidad('VIN48A')), null)$$, 'ubicación');
\echo '✔ 1. D37: vendedor y anon rechazados; security invoker; exige motos y ubicación'

-- ---------------------------------------------------------------- 2. Caso feliz 48V y 60V (técnico)
create temp table resultado as
select public.listo_rapido(jsonb_build_array(
  test.unidad('VIN48A', '[{"posicion": 1, "serial": " bat-real-1 "}, {"posicion": 2, "serial": ""}]'),
  test.unidad('VIN60A')), test.id('showroom')) r;
do $$
declare r jsonb := (select r from resultado);
begin
  assert (r ->> 'unidades')::int = 2, 'dos motos';
  assert (r ->> 'baterias')::int = 9, '4 + 5 baterías';
  assert (r ->> 'provisionales')::int = 8, '3 + 5 provisionales';

  assert (select estado from public.vehicle_inventory where id = test.id('VIN48A')) = 'listo_en_tienda', '48 en tienda';
  assert (select location_id from public.vehicle_inventory where id = test.id('VIN60A')) = test.id('showroom'), 'ubicación';
  assert (select array_agg(serial order by posicion) from public.vehicle_batteries where vehicle_id = test.id('VIN48A'))
    = array['BAT-REAL-1', 'PROV-VIN48A-2', 'PROV-VIN48A-3', 'PROV-VIN48A-4'], 'serial real normalizado + PROV-';
  assert (select count(*) from public.vehicle_batteries where vehicle_id = test.id('VIN60A') and serial like 'PROV-VIN60A-%') = 5,
    '60V: 5 provisionales';
  -- Mismos pasos que el flujo normal: historial en_caja → en_ensamble → listo_en_tienda
  assert (select array_agg(estado_nuevo::text order by id) from public.vehicle_status_history where vehicle_id = test.id('VIN48A'))
    = array['en_caja', 'en_ensamble', 'listo_en_tienda'], 'historial con los tres pasos';
  -- RN-11: inspección aprobada por la columna generada, marcada como Listo rápido
  assert (select aprobada and baterias_esperadas = 4 and (checklist ->> 'listo_rapido')::boolean
            and (checklist ->> 'frenos')::boolean and voltaje_medido is null
            and inspector_id = test.id('tecnico@ev.pe')
          from public.technical_inspections where vehicle_id = test.id('VIN48A')), 'inspección aprobada y marcada';
end $$;
\echo '✔ 2. RN-10/RN-11: 48V y 60V pasan a tienda con historial, inspección aprobada y seriales PROV- únicos'

-- ---------------------------------------------------------------- 3. 72V en ensamble conserva sus baterías
select public.listo_rapido(jsonb_build_array(test.unidad('VIN72A', '[{"posicion": 2, "serial": "REAL72-2"}]')), test.id('showroom'));
do $$ begin
  assert (select array_agg(serial order by posicion) from public.vehicle_batteries where vehicle_id = test.id('VIN72A'))
    = array['REAL72-1', 'REAL72-2', 'REAL72-3', 'PROV-VIN72A-4', 'PROV-VIN72A-5', 'PROV-VIN72A-6'], 'conserva y completa';
  assert (select estado from public.vehicle_inventory where id = test.id('VIN72A')) = 'listo_en_tienda', '72 en tienda';
end $$;
\echo '✔ 3. RN-02: una moto en ensamble conserva sus baterías y se completa hasta 6 (72V)'

-- ---------------------------------------------------------------- 4. Todo o nada
-- VIN48B está bien, pero VIN48C repite un serial ya registrado → no se guarda ninguna
select test.expect_error($$select public.listo_rapido(jsonb_build_array(
  test.unidad('VIN48B'), test.unidad('VIN48C', '[{"posicion": 1, "serial": "BAT-REAL-1"}]')), test.id('showroom'))$$,
  'Moto VIN48C: un serial de batería está repetido o ya está registrado');
do $$ begin
  assert (select estado from public.vehicle_inventory where id = test.id('VIN48B')) = 'en_caja', 'VIN48B sigue en caja';
  assert not exists (select 1 from public.vehicle_batteries where vehicle_id in (test.id('VIN48B'), test.id('VIN48C'))), 'sin baterías';
  assert not exists (select 1 from public.technical_inspections where vehicle_id = test.id('VIN48B')), 'sin inspección';
end $$;
\echo '✔ 4. Todo o nada: un serial repetido en una moto deshace todas (RN-03)'

-- ---------------------------------------------------------------- 5. Reglas que no se saltan
select test.expect_error($$select public.listo_rapido(jsonb_build_array(test.unidad('VIN48A')), test.id('showroom'))$$,
  'Moto VIN48A: Solo se aplica a motos en caja o en ensamble (estado actual: listo_en_tienda)');
select test.expect_error($$select public.listo_rapido(jsonb_build_array(
  test.unidad('VIN48B', '[{"posicion": 1, "serial": "prov-falso"}]')), test.id('showroom'))$$,
  'el prefijo PROV- está reservado');
select test.expect_error($$select public.listo_rapido(jsonb_build_array(
  test.unidad('VIN48B', '[{"posicion": 2, "serial": "X1"}, {"posicion": 3, "serial": "X1"}]')), test.id('showroom'))$$,
  'ya está registrado');
reset role;
update public.locations set activo = false where nombre = 'Almacén Central';
insert into test.ids select 'inactiva', id from public.locations where nombre = 'Almacén Central';
set role authenticated;
select test.como('tecnico@ev.pe');
select test.expect_error($$select public.listo_rapido(jsonb_build_array(test.unidad('VIN48B')), test.id('inactiva'))$$,
  'ubicación en tienda activa');
do $$ begin
  assert (select estado from public.vehicle_inventory where id = test.id('VIN48B')) = 'en_caja', 'VIN48B intacta';
end $$;
\echo '✔ 5. No se aplica a motos en tienda, PROV- reservado, seriales repetidos y ubicación inactiva rechazados'

-- ---------------------------------------------------------------- 6. Reemplazar un provisional por el real
update public.vehicle_batteries set serial = 'real-48a-2' where serial = 'PROV-VIN48A-2';
do $$ begin
  assert exists (select 1 from public.vehicle_batteries where vehicle_id = test.id('VIN48A') and posicion = 2 and serial = 'REAL-48A-2'),
    'UPDATE normaliza el serial (guard_battery)';
  assert (select count(*) from public.vehicle_batteries where vehicle_id = test.id('VIN48A')) = 4, 'sigue con 4';
end $$;
\echo '✔ 6. Un serial provisional se reemplaza por el real con un UPDATE (el técnico)'

\echo 'TODAS LAS PRUEBAS DE listo_rapido PASARON'
