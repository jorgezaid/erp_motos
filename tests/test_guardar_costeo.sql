-- =============================================================================
-- Pruebas de la RPC guardar_costeo (SPEC §7 "Persistencia", RN-06, RN-07, RN-09)
-- Uso: ./tests/run.sh   (cada bloque falla con ASSERT si una regla no se cumple)
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

-- Payloads de prueba (mismo formato que FilaCosteo de src/lib/costing/prorrateo.ts)
create table test.filas (k text primary key, v jsonb);
grant all on test.filas to authenticated;
create function test.f(k text) returns jsonb language sql stable as $$ select v from test.filas where filas.k = $1 $$;
-- Cambia un campo de la fila `idx` (0 = primera) de un payload
create function test.cambia(p jsonb, idx int, campo text, valor text) returns jsonb language sql immutable as
$$ select jsonb_set(p, array[idx::text, campo], to_jsonb(valor)) $$;
grant execute on function test.f(text), test.cambia(jsonb, int, text, text) to authenticated;

-- ---------------------------------------------------------------- usuarios
insert into auth.users (id, email, raw_user_meta_data) values
  (gen_random_uuid(), 'admin@ev.pe',   '{"nombre":"Ana Admin"}'),
  (gen_random_uuid(), 'tecnico@ev.pe', '{"nombre":"Tito Técnico"}'),
  (gen_random_uuid(), 'ventas@ev.pe',  '{"nombre":"Vero Ventas"}'),
  (gen_random_uuid(), 'nuevo@ev.pe',   '{}');
update public.profiles p set rol = x.rol::public.app_role
from (values ('admin@ev.pe','admin'), ('tecnico@ev.pe','tecnico'), ('ventas@ev.pe','vendedor')) x(email, rol)
join auth.users u on u.email = x.email where p.id = u.id;

set role authenticated;
select test.como('admin@ev.pe');

-- ---------------------------------------------------------------- lote del golden test (SPEC §7)
insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('TEST-48', 'bicimoto', 48, 20, 500, 0.50, 300),
       ('TEST-72', 'trimoto_carga', 72, 32, 1200, 2.00, 900),
       ('TEST-60', 'bicimoto', 60, 20, 800, 0.80, 500);

-- Impuestos asignables = 500 + 1000 + 200 + 300 = 2000; armado 60 (valor por defecto)
insert into public.import_batches (codigo_embarque, tipo_cambio, fob_total_usd, flete_internacional_usd,
  gastos_agente_usd, ad_valorem_pen, igv_pen, ipm_pen, percepcion_pen, flete_nacional_pen,
  alquiler_periodo_pen, sueldos_periodo_pen, publicidad_inicial_pen)
values ('GOLDEN-SPEC7', 3.78, 7200, 800, 200, 500, 1000, 200, 300, 400, 1000, 2000, 200),
       ('ASIMETRICO',   3.78, 7200, 800, 200, 500, 1000, 200, 300, 400, 1000, 2000, 200);

insert into test.ids select 'lote', id from public.import_batches where codigo_embarque = 'GOLDEN-SPEC7';
insert into test.ids select 'lote2', id from public.import_batches where codigo_embarque = 'ASIMETRICO';
insert into test.ids select 'm48', id from public.vehicle_models where codigo_modelo = 'TEST-48';
insert into test.ids select 'm72', id from public.vehicle_models where codigo_modelo = 'TEST-72';
insert into test.ids select 'm60', id from public.vehicle_models where codigo_modelo = 'TEST-60';

insert into public.batch_items (batch_id, model_id, cantidad_packing_list)
values (test.id('lote'), test.id('m48'), 6), (test.id('lote'), test.id('m72'), 2),
       (test.id('lote2'), test.id('m48'), 4), (test.id('lote2'), test.id('m72'), 2);

-- Filas EXACTAS de la tabla de SPEC §7 (lo que devuelve calcularProrrateo)
insert into test.filas values ('golden', jsonb_build_array(
  jsonb_build_object('model_id', test.id('m48'), 'cantidad', 6, 'tipo_cambio', '3.7800',
    'fob_asignado_usd', '3600.0000', 'impuestos_asignados_pen', '1000.0000',
    'flete_internacional_asignado_usd', '342.8571', 'gastos_agente_asignado_usd', '85.7143',
    'flete_nacional_asignado_pen', '171.4286', 'alquiler_asignado_pen', '750.0000',
    'sueldos_asignado_pen', '1500.0000', 'publicidad_asignada_pen', '150.0000', 'armado_pen', '360.0000'),
  jsonb_build_object('model_id', test.id('m72'), 'cantidad', 2, 'tipo_cambio', '3.7800',
    'fob_asignado_usd', '3600.0000', 'impuestos_asignados_pen', '1000.0000',
    'flete_internacional_asignado_usd', '457.1429', 'gastos_agente_asignado_usd', '114.2857',
    'flete_nacional_asignado_pen', '228.5714', 'alquiler_asignado_pen', '250.0000',
    'sueldos_asignado_pen', '500.0000', 'publicidad_asignada_pen', '50.0000', 'armado_pen', '120.0000')));

-- Lote asimétrico: TEST-48 ×4 (EXW 1200, CBM 2) y TEST-72 ×2 (EXW 1800, CBM 4)
insert into test.filas values ('asimetrico', jsonb_build_array(
  jsonb_build_object('model_id', test.id('m48'), 'cantidad', 4, 'tipo_cambio', '3.7800',
    'fob_asignado_usd', '2880.0000', 'impuestos_asignados_pen', '800.0000',
    'flete_internacional_asignado_usd', '266.6667', 'gastos_agente_asignado_usd', '66.6667',
    'flete_nacional_asignado_pen', '133.3333', 'alquiler_asignado_pen', '666.6667',
    'sueldos_asignado_pen', '1333.3333', 'publicidad_asignada_pen', '133.3333', 'armado_pen', '240.0000'),
  jsonb_build_object('model_id', test.id('m72'), 'cantidad', 2, 'tipo_cambio', '3.7800',
    'fob_asignado_usd', '4320.0000', 'impuestos_asignados_pen', '1200.0000',
    'flete_internacional_asignado_usd', '533.3333', 'gastos_agente_asignado_usd', '133.3333',
    'flete_nacional_asignado_pen', '266.6667', 'alquiler_asignado_pen', '333.3333',
    'sueldos_asignado_pen', '666.6667', 'publicidad_asignada_pen', '66.6667', 'armado_pen', '120.0000')));
\echo '✔ 1. Lote del golden test (SPEC §7) y lote asimétrico'

-- ---------------------------------------------------------------- guardado correcto
select public.guardar_costeo(test.id('lote'), test.f('golden'));

do $$ begin
  assert (select costo_landing_unitario_pen from public.batch_model_costs
          where batch_id = test.id('lote') and model_id = test.id('m48')) = 3193.24,
    'SPEC §7: TEST-48 = 3193.24 (TypeScript y la BD coinciden)';
  assert (select costo_landing_unitario_pen from public.batch_model_costs
          where batch_id = test.id('lote') and model_id = test.id('m72')) = 8958.29,
    'SPEC §7: TEST-72 = 8958.29 (TypeScript y la BD coinciden)';
  assert (select round(sum(costo_total_pen), 2) from public.batch_model_costs
          where batch_id = test.id('lote')) = 37076.00, 'SPEC §7: costo total del lote = 37 076.00';
  assert (select bool_and(calculado_por = auth.uid()) from public.batch_model_costs
          where batch_id = test.id('lote')), 'calculado_por = el admin que guardó';
end $$;

-- Idempotente: volver a guardar reemplaza, no duplica
select public.guardar_costeo(test.id('lote'), test.f('golden'));
do $$ begin
  assert (select count(*) from public.batch_model_costs where batch_id = test.id('lote')) = 2, 'reemplaza las 2 filas';
end $$;

select public.guardar_costeo(test.id('lote2'), test.f('asimetrico'));
do $$ begin
  assert (select count(*) from public.batch_model_costs where batch_id = test.id('lote2')) = 2, 'lote asimétrico guardado';
end $$;
\echo '✔ 2. RN-06: guarda el golden test y la BD calcula 3193.24 / 8958.29 / 37 076.00'

-- ---------------------------------------------------------------- rechazos
-- Invariante 1: descuadre de un concepto (+0.02 en el alquiler de TEST-48)
select test.expect_error($$select public.guardar_costeo(test.id('lote'),
  test.cambia(test.f('golden'), 0, 'alquiler_asignado_pen', '750.0200'))$$, 'alquiler asignado suma');

-- Invariante 2: +0.009 en FOB, flete internacional y agente de TEST-48 pasan los invariantes 1 y 4
-- (≤ 0.01 cada uno), pero en soles son 0.027 × 3.78 = 0.10 de descuadre en el total
select test.expect_error($$select public.guardar_costeo(test.id('lote'),
  test.cambia(test.cambia(test.cambia(test.f('golden'),
    0, 'fob_asignado_usd', '3600.0090'), 0, 'flete_internacional_asignado_usd', '342.8661'),
    0, 'gastos_agente_asignado_usd', '85.7233'))$$, 'costo total del lote');

-- Modelo faltante, sobrante y repetido
select test.expect_error($$select public.guardar_costeo(test.id('lote'),
  jsonb_build_array(test.f('golden') -> 0))$$, 'Falta el costeo de: TEST-72');
select test.expect_error($$select public.guardar_costeo(test.id('lote'),
  test.f('golden') || jsonb_build_array(test.cambia(test.f('golden'), 0, 'model_id', test.id('m60')::text) -> 0))$$,
  'no están en el packing list: TEST-60');
select test.expect_error($$select public.guardar_costeo(test.id('lote'),
  test.f('golden') || jsonb_build_array(test.f('golden') -> 0))$$, 'repetido');

-- Tipo de cambio y cantidad distintos a los del lote
select test.expect_error($$select public.guardar_costeo(test.id('lote'),
  test.cambia(test.f('golden'), 1, 'tipo_cambio', '3.8000'))$$, 'tipo de cambio');
select test.expect_error($$select public.guardar_costeo(test.id('lote'),
  test.cambia(test.f('golden'), 1, 'cantidad', '3'))$$, 'cantidad');

-- Montos negativos que se compensan (el total sigue en 200)
select test.expect_error($$select public.guardar_costeo(test.id('lote'),
  test.cambia(test.cambia(test.f('golden'), 0, 'publicidad_asignada_pen', '-50.0000'),
    1, 'publicidad_asignada_pen', '250.0000'))$$, 'negativo');

-- Invariante 4: FOB repartido por CBM (3/7 y 4/7) en vez de por EXW; el total sigue en 7200
select test.expect_error($$select public.guardar_costeo(test.id('lote'),
  test.cambia(test.cambia(test.f('golden'), 0, 'fob_asignado_usd', '3085.7143'),
    1, 'fob_asignado_usd', '4114.2857'))$$, 'Modelo TEST-48: FOB asignado US$ 3085.7143, esperado US$ 3600.0000');

-- Invariante 4: FOB intercambiado entre modelos. En el golden test no sirve (ambos tienen
-- EXW 1800 → 3600 cada uno), así que se prueba en el lote asimétrico (EXW 1200 / 1800)
select test.expect_error($$select public.guardar_costeo(test.id('lote2'),
  test.cambia(test.cambia(test.f('asimetrico'), 0, 'fob_asignado_usd', '4320.0000'),
    1, 'fob_asignado_usd', '2880.0000'))$$, 'Modelo TEST-48: FOB asignado US$ 4320.0000, esperado US$ 2880.0000');

-- Invariante 4: armado distinto de cantidad × 60 (aunque la suma sea 480)
select test.expect_error($$select public.guardar_costeo(test.id('lote'),
  test.cambia(test.cambia(test.f('golden'), 0, 'armado_pen', '359.9900'), 1, 'armado_pen', '120.0100'))$$,
  'Modelo TEST-48: armado asignado S/ 359.9900, esperado S/ 360.0000');

-- Payload vacío, mal formado y lote inexistente
select test.expect_error($$select public.guardar_costeo(test.id('lote'), '[]'::jsonb)$$, 'no tiene filas');
select test.expect_error($$select public.guardar_costeo(test.id('lote'),
  test.cambia(test.f('golden'), 0, 'fob_asignado_usd', 'abc'))$$, 'formato');
select test.expect_error($$select public.guardar_costeo(test.id('lote'),
  test.f('golden') #- '{0,sueldos_asignado_pen}')$$, 'campos vacíos');
select test.expect_error($$select public.guardar_costeo(gen_random_uuid(), test.f('golden'))$$, 'no existe');

-- Atomicidad: ningún rechazo tocó lo ya guardado
do $$ begin
  assert (select count(*) from public.batch_model_costs where batch_id = test.id('lote')) = 2, 'siguen 2 filas';
  assert (select costo_landing_unitario_pen from public.batch_model_costs
          where batch_id = test.id('lote') and model_id = test.id('m48')) = 3193.24, 'TEST-48 intacto';
  assert (select fob_asignado_usd from public.batch_model_costs
          where batch_id = test.id('lote2') and model_id = test.id('m48')) = 2880, 'lote asimétrico intacto';
end $$;
\echo '✔ 3. Rechaza descuadres (invariantes 1, 2 y 4), modelos faltantes o sobrantes, TC y cantidad distintos'

-- ---------------------------------------------------------------- solo admin
select test.como('ventas@ev.pe');
select test.expect_error($$select public.guardar_costeo(test.id('lote'), test.f('golden'))$$, 'Solo un administrador');
select test.como('tecnico@ev.pe');
select test.expect_error($$select public.guardar_costeo(test.id('lote'), test.f('golden'))$$, 'Solo un administrador');
select test.como('nuevo@ev.pe');
select test.expect_error($$select public.guardar_costeo(test.id('lote'), test.f('golden'))$$, 'Solo un administrador');

reset role;
set role anon;
select test.expect_error($$select public.guardar_costeo(gen_random_uuid(), '[]'::jsonb)$$, 'permission denied');
reset role;
set role authenticated;
\echo '✔ 4. Solo el admin guarda el costeo; anon no puede ejecutar la RPC'

-- ---------------------------------------------------------------- liquidación y precios
select test.como('admin@ev.pe');
update public.import_batches set estado = 'liquidado' where id = test.id('lote');

do $$ begin
  assert (select precio_x1 from public.v_price_matrix where batch_id = test.id('lote') and model_id = test.id('m48')) = 5805.89,
    'SPEC §7: x1 TEST-48 = 3193.24 / 0.55 = 5805.89';
  assert (select precio_x3 from public.v_price_matrix where batch_id = test.id('lote') and model_id = test.id('m48')) = 4912.68,
    'SPEC §7: x3 TEST-48 = 4912.68';
  assert (select precio_x6 from public.v_price_matrix where batch_id = test.id('lote') and model_id = test.id('m48')) = 4435.06,
    'SPEC §7: x6 TEST-48 = 4435.06';
end $$;

select test.expect_error($$select public.guardar_costeo(test.id('lote'), test.f('golden'))$$, 'está liquidado');
\echo '✔ 5. RN-07/RN-09: liquidar genera x1 = 5805.89 para TEST-48; un lote liquidado no se recostea'
\echo ''
\echo 'TODAS LAS PRUEBAS DE guardar_costeo PASARON'
