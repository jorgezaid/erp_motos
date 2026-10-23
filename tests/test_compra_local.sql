-- =============================================================================
-- Pruebas de la compra local (D41, 17.3): reglas del lote, líneas con precio de compra, costeo
-- con IGV (incluido o no, al costo o no), liquidación con precios, permisos, y que el costeo
-- de importación (golden test de SPEC §7) sigue igual.
-- Uso: ./tests/run.sh
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

create table test.filas (k text primary key, v jsonb);
grant all on test.filas to authenticated;
create function test.f(k text) returns jsonb language sql stable as $$ select v from test.filas where filas.k = $1 $$;
create function test.cambia(p jsonb, idx int, campo text, valor text) returns jsonb language sql immutable as
$$ select jsonb_set(p, array[idx::text, campo], to_jsonb(valor)) $$;
grant execute on function test.f(text), test.cambia(jsonb, int, text, text) to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  (gen_random_uuid(), 'admin@ev.pe', '{"nombre":"Ana"}'),
  (gen_random_uuid(), 'tecnico@ev.pe', '{"nombre":"Tito"}'),
  (gen_random_uuid(), 'vendedor@ev.pe', '{"nombre":"Vico"}');
update public.profiles p set rol = x.rol::public.app_role
from (values ('admin@ev.pe','admin'), ('tecnico@ev.pe','tecnico'), ('vendedor@ev.pe','vendedor')) x(email, rol)
join auth.users u on u.email = x.email where p.id = u.id;

set role authenticated;
select test.como('admin@ev.pe');

-- Modelos de Luna Importaciones: trimotos con techo, sin EXW ni CBM
insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, tipo_bateria, baterias_litio, tiene_techo)
values ('LUNA-T', 'trimoto_pasajeros', 60, 50, 1000, 'litio', 1, true),
       ('LUNA-C', 'trimoto_carga', 72, 45, 1500, 'plomo_12v', null, true);
insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('TEST-48', 'bicimoto', 48, 20, 500, 0.50, 300),
       ('TEST-72', 'trimoto_carga', 72, 32, 1200, 2.00, 900);
insert into test.ids select codigo_modelo, id from public.vehicle_models;
insert into public.proveedores (nombre, ruc) values ('Luna Importaciones', '20123456789');
insert into test.ids select 'luna', id from public.proveedores where nombre = 'Luna Importaciones';

-- ---------------------------------------------------------------- 1. Reglas del lote
insert into public.import_batches (codigo_embarque, tipo_lote, proveedor_id, nro_factura, fecha_compra, tipo_cambio,
                                   precio_incluye_igv, flete_nacional_pen, otros_gastos_pen, costo_armado_unitario_pen)
values ('CL-F001-123', 'compra_local', test.id('luna'), 'F001-123', '2026-10-20', 1, true, 1000, 100, 50);
insert into test.ids select 'cl', id from public.import_batches where codigo_embarque = 'CL-F001-123';

select test.expect_error($$insert into public.import_batches (codigo_embarque, tipo_lote, tipo_cambio)
  values ('CL-X', 'compra_local', 3.75)$$, 'import_batches_compra_local_check');
select test.expect_error($$update public.import_batches set fob_total_usd = 10 where id = test.id('cl')$$,
  'import_batches_compra_local_check');
select test.expect_error($$update public.import_batches set estado = 'en_aduanas' where id = test.id('cl')$$,
  'import_batches_compra_local_check');
select test.expect_error($$update public.import_batches set tipo_lote = 'importacion' where id = test.id('cl')$$,
  'no puede cambiar de tipo');
select test.expect_error($$insert into public.import_batches (codigo_embarque, otros_gastos_pen) values ('IMP-X', 5)$$,
  'import_batches_compra_local_check');
\echo '✔ 1. D41: compra local solo en PEN (TC 1), sin montos de importación ni aduanas; el tipo no cambia'

-- ---------------------------------------------------------------- 2. Líneas
select test.expect_error($$insert into public.batch_items (batch_id, model_id, cantidad_packing_list)
  values (test.id('cl'), test.id('LUNA-T'), 4)$$, 'Indica el precio de compra unitario del modelo LUNA-T');
insert into public.batch_items (batch_id, model_id, cantidad_packing_list, precio_compra_unitario_pen)
values (test.id('cl'), test.id('LUNA-T'), 4, 5900), (test.id('cl'), test.id('LUNA-C'), 2, 7080);
\echo '✔ 2. D41: la línea de una compra local exige el precio de compra (sin EXW ni CBM)'

-- ---------------------------------------------------------------- 3. Costeo con IGV incluido y al costo
-- LUNA-T: 4 × 5 900 = 23 600 → compra 20 000, IGV 3 600; flete 666.6667; otros 66.6667; armado 200
-- LUNA-C: 2 × 7 080 = 14 160 → compra 12 000, IGV 2 160; flete 333.3333; otros 33.3333; armado 100
insert into test.filas values ('luna', jsonb_build_array(
  jsonb_build_object('model_id', test.id('LUNA-C'), 'cantidad', 2, 'tipo_cambio', '1.0000',
    'fob_asignado_usd', '0.0000', 'impuestos_asignados_pen', '2160.0000',
    'flete_internacional_asignado_usd', '0.0000', 'gastos_agente_asignado_usd', '0.0000',
    'flete_nacional_asignado_pen', '333.3333', 'alquiler_asignado_pen', '0.0000',
    'sueldos_asignado_pen', '0.0000', 'publicidad_asignada_pen', '0.0000', 'armado_pen', '100.0000',
    'compra_asignada_pen', '12000.0000', 'otros_gastos_asignado_pen', '33.3333'),
  jsonb_build_object('model_id', test.id('LUNA-T'), 'cantidad', 4, 'tipo_cambio', '1.0000',
    'fob_asignado_usd', '0.0000', 'impuestos_asignados_pen', '3600.0000',
    'flete_internacional_asignado_usd', '0.0000', 'gastos_agente_asignado_usd', '0.0000',
    'flete_nacional_asignado_pen', '666.6667', 'alquiler_asignado_pen', '0.0000',
    'sueldos_asignado_pen', '0.0000', 'publicidad_asignada_pen', '0.0000', 'armado_pen', '200.0000',
    'compra_asignada_pen', '20000.0000', 'otros_gastos_asignado_pen', '66.6667')));

select public.guardar_costeo(test.id('cl'), test.f('luna'));
do $$ begin
  assert (select costo_landing_unitario_pen from public.batch_model_costs where model_id = test.id('LUNA-T')) = 6133.33, 'LUNA-T 6133.33';
  assert (select costo_landing_unitario_pen from public.batch_model_costs where model_id = test.id('LUNA-C')) = 7313.33, 'LUNA-C 7313.33';
  assert (select sum(costo_total_pen) from public.batch_model_costs where batch_id = test.id('cl')) = 39160.0000, 'total 39 160';
end $$;
\echo '✔ 3. D41: precio con IGV y IGV al costo → LUNA-T S/ 6 133.33 y LUNA-C S/ 7 313.33 (lote S/ 39 160)'

-- ---------------------------------------------------------------- 4. La RPC vuelve a validar
select test.expect_error($$select public.guardar_costeo(test.id('cl'), test.cambia(test.f('luna'), 1, 'compra_asignada_pen', '19999.0000'))$$,
  'compra asignada');
select test.expect_error($$select public.guardar_costeo(test.id('cl'), test.cambia(test.f('luna'), 1, 'impuestos_asignados_pen', '0.0000'))$$,
  'IGV asignado');
-- Flete por cantidad, no por precio: intercambiar el reparto descuadra la proporción
select test.expect_error($$select public.guardar_costeo(test.id('cl'),
  test.cambia(test.cambia(test.f('luna'), 1, 'flete_nacional_asignado_pen', '333.3333'), 0, 'flete_nacional_asignado_pen', '666.6667'))$$,
  'flete nacional asignado');
select test.expect_error($$select public.guardar_costeo(test.id('cl'), test.cambia(test.f('luna'), 0, 'otros_gastos_asignado_pen', '0.0000'))$$,
  'otros gastos');
select test.expect_error($$select public.guardar_costeo(test.id('cl'), test.cambia(test.f('luna'), 0, 'fob_asignado_usd', '1.0000'))$$,
  'montos de importación');
do $$ begin
  assert (select count(*) from public.batch_model_costs where batch_id = test.id('cl')) = 2, 'el costeo anterior sigue';
end $$;
\echo '✔ 4. D41: guardar_costeo rechaza compra, IGV, flete u otros gastos mal repartidos'

-- ---------------------------------------------------------------- 5. IGV no al costo y precio sin IGV
-- Cambiar el interruptor borra el costeo (D21); con IGV como crédito fiscal, impuestos = 0
update public.import_batches set impuestos_recuperables_al_costo = false where id = test.id('cl');
do $$ begin
  assert (select count(*) from public.batch_model_costs where batch_id = test.id('cl')) = 0, 'D21 invalida';
end $$;
select public.guardar_costeo(test.id('cl'),
  test.cambia(test.cambia(test.f('luna'), 0, 'impuestos_asignados_pen', '0.0000'), 1, 'impuestos_asignados_pen', '0.0000'));
do $$ begin
  assert (select costo_landing_unitario_pen from public.batch_model_costs where model_id = test.id('LUNA-T')) = 5233.33, 'LUNA-T 5233.33';
  assert (select costo_landing_unitario_pen from public.batch_model_costs where model_id = test.id('LUNA-C')) = 6233.33, 'LUNA-C 6233.33';
end $$;
-- Precio sin IGV: compra = 4 × 5 900 = 23 600, IGV 4 248 (no va al costo)
update public.import_batches set precio_incluye_igv = false where id = test.id('cl');
select public.guardar_costeo(test.id('cl'),
  test.cambia(test.cambia(test.cambia(test.cambia(test.f('luna'),
    0, 'impuestos_asignados_pen', '0.0000'), 1, 'impuestos_asignados_pen', '0.0000'),
    0, 'compra_asignada_pen', '14160.0000'), 1, 'compra_asignada_pen', '23600.0000'));
do $$ begin
  assert (select costo_total_pen from public.batch_model_costs where model_id = test.id('LUNA-T')) = 24533.3334, 'sin IGV';
end $$;
\echo '✔ 5. D41: IGV como crédito fiscal (no va al costo) y precio sin IGV'

-- ---------------------------------------------------------------- 6. Liquidar → precios
update public.import_batches set estado = 'liquidado' where id = test.id('cl');
do $$ begin
  assert (select count(*) from public.price_list where batch_id = test.id('cl')) = 6, '2 modelos × 3 escalas';
  assert (select liquidado_at is not null from public.import_batches where id = test.id('cl')), 'liquidado';
end $$;
\echo '✔ 6. D41: la compra local se liquida y genera la lista de precios con el margen vigente'

-- ---------------------------------------------------------------- 7. Permisos
select test.como('vendedor@ev.pe');
do $$ begin
  assert (select count(*) from public.import_batches) = 0, 'vendedor no ve lotes';
  assert (select count(*) from public.batch_items) = 0, 'vendedor no ve líneas';
  assert (select count(*) from public.batch_model_costs) = 0, 'vendedor no ve costos';
  assert (select count(*) from public.price_list where batch_id = test.id('cl')) = 6, 'vendedor sí ve precios';
end $$;
select test.como('tecnico@ev.pe');
do $$ begin
  assert (select count(*) from public.import_batches) = 0, 'técnico no ve lotes';
  assert (select count(*) from public.batch_model_costs) = 0, 'técnico no ve costos';
end $$;
select test.expect_error($$select public.guardar_costeo(test.id('cl'), test.f('luna'))$$, 'Solo un administrador');
\echo '✔ 7. Vendedor y técnico no ven compras ni costos'

-- ---------------------------------------------------------------- 8. Importación sin cambios
select test.como('admin@ev.pe');
insert into public.import_batches (codigo_embarque, tipo_cambio, fob_total_usd, flete_internacional_usd,
  gastos_agente_usd, ad_valorem_pen, igv_pen, ipm_pen, percepcion_pen, flete_nacional_pen,
  alquiler_periodo_pen, sueldos_periodo_pen, publicidad_inicial_pen)
values ('GOLDEN-SPEC7', 3.78, 7200, 800, 200, 500, 1000, 200, 300, 400, 1000, 2000, 200);
insert into test.ids select 'golden', id from public.import_batches where codigo_embarque = 'GOLDEN-SPEC7';
insert into public.batch_items (batch_id, model_id, cantidad_packing_list)
values (test.id('golden'), test.id('TEST-48'), 6), (test.id('golden'), test.id('TEST-72'), 2);
select test.expect_error($$insert into public.batch_items (batch_id, model_id, cantidad_packing_list, precio_compra_unitario_pen)
  values (test.id('golden'), test.id('LUNA-T'), 1, 100)$$, 'no tiene EXW/CBM');

-- Filas de SPEC §7 sin las columnas nuevas (como las enviaba la app antes)
select public.guardar_costeo(test.id('golden'), jsonb_build_array(
  jsonb_build_object('model_id', test.id('TEST-48'), 'cantidad', 6, 'tipo_cambio', '3.7800',
    'fob_asignado_usd', '3600.0000', 'impuestos_asignados_pen', '1000.0000',
    'flete_internacional_asignado_usd', '342.8571', 'gastos_agente_asignado_usd', '85.7143',
    'flete_nacional_asignado_pen', '171.4286', 'alquiler_asignado_pen', '750.0000',
    'sueldos_asignado_pen', '1500.0000', 'publicidad_asignada_pen', '150.0000', 'armado_pen', '360.0000'),
  jsonb_build_object('model_id', test.id('TEST-72'), 'cantidad', 2, 'tipo_cambio', '3.7800',
    'fob_asignado_usd', '3600.0000', 'impuestos_asignados_pen', '1000.0000',
    'flete_internacional_asignado_usd', '457.1429', 'gastos_agente_asignado_usd', '114.2857',
    'flete_nacional_asignado_pen', '228.5714', 'alquiler_asignado_pen', '250.0000',
    'sueldos_asignado_pen', '500.0000', 'publicidad_asignada_pen', '50.0000', 'armado_pen', '120.0000')));
do $$ begin
  assert (select costo_landing_unitario_pen from public.batch_model_costs where model_id = test.id('TEST-48')) = 3193.24, 'golden 48';
  assert (select costo_landing_unitario_pen from public.batch_model_costs where model_id = test.id('TEST-72')) = 8958.29, 'golden 72';
  assert (select sum(costo_total_pen) from public.batch_model_costs where batch_id = test.id('golden')) = 37076.0000, 'golden total';
  assert (select tipo_lote from public.import_batches where id = test.id('golden')) = 'importacion', 'por defecto importación';
end $$;
select test.expect_error($$select public.guardar_costeo(test.id('golden'),
  jsonb_set(jsonb_set(test.f('luna'), '{0,model_id}', to_jsonb(test.id('TEST-72'))), '{1,model_id}', to_jsonb(test.id('TEST-48'))))$$,
  'no coincide');
\echo '✔ 8. Importación sin cambios: golden test de SPEC §7 (S/ 3 193.24 y S/ 8 958.29, lote S/ 37 076)'

-- ---------------------------------------------------------------- 9. Costo total por cualquier vía
select test.expect_error($$update public.batch_model_costs set costo_total_pen = 1 where batch_id = test.id('cl')$$, 'liquidado');
update public.batch_model_costs set costo_landing_unitario_pen = 1 where batch_id = test.id('golden') and model_id = test.id('TEST-48');
do $$ begin
  assert (select costo_landing_unitario_pen from public.batch_model_costs where model_id = test.id('TEST-48')) = 3193.24,
    'el trigger recalcula';
end $$;
reset role;
set session_replication_role = replica;
select test.expect_error($$update public.batch_model_costs set costo_landing_unitario_pen = 1
  where model_id = (select id from public.vehicle_models where codigo_modelo = 'TEST-48')$$, 'batch_model_costs_costo_total_check');
set session_replication_role = default;
\echo '✔ 9. El costo total y el landing no se escriben a mano: los recalcula un trigger y un CHECK exige la fórmula'

\echo 'TODAS LAS PRUEBAS DE compra_local PASARON'
