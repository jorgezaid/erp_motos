-- =============================================================================
-- Pruebas: el costeo guardado se invalida si cambian los montos o el packing list (D21)
-- Uso: ./tests/run.sh
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'admin@ev.pe', '{"nombre":"Ana"}');
update public.profiles set rol = 'admin';

-- Guarda el costeo del golden test (SPEC §7)
create function test.guardar() returns void language sql as $f$
  select null from public.guardar_costeo(test.id('lote'), jsonb_build_array(
    jsonb_build_object('model_id', test.id('m48'), 'cantidad', 6, 'tipo_cambio', '3.78',
      'fob_asignado_usd', '3600', 'impuestos_asignados_pen', '1000', 'flete_internacional_asignado_usd', '342.8571',
      'gastos_agente_asignado_usd', '85.7143', 'flete_nacional_asignado_pen', '171.4286', 'alquiler_asignado_pen', '750',
      'sueldos_asignado_pen', '1500', 'publicidad_asignada_pen', '150', 'armado_pen', '360'),
    jsonb_build_object('model_id', test.id('m72'), 'cantidad', 2, 'tipo_cambio', '3.78',
      'fob_asignado_usd', '3600', 'impuestos_asignados_pen', '1000', 'flete_internacional_asignado_usd', '457.1429',
      'gastos_agente_asignado_usd', '114.2857', 'flete_nacional_asignado_pen', '228.5714', 'alquiler_asignado_pen', '250',
      'sueldos_asignado_pen', '500', 'publicidad_asignada_pen', '50', 'armado_pen', '120')))
$f$;
grant execute on function test.guardar() to authenticated;
create function test.filas() returns bigint language sql as $f$
  select count(*) from public.batch_model_costs where batch_id = test.id('lote') $f$;
grant execute on function test.filas() to authenticated;

set role authenticated;
select test.como('admin@ev.pe');

insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('TEST-48', 'bicimoto', 48, 20, 500, 0.50, 300), ('TEST-72', 'trimoto_carga', 72, 32, 1200, 2.00, 900);
insert into public.import_batches (codigo_embarque, tipo_cambio, fob_total_usd, flete_internacional_usd,
  gastos_agente_usd, ad_valorem_pen, igv_pen, ipm_pen, percepcion_pen, flete_nacional_pen,
  alquiler_periodo_pen, sueldos_periodo_pen, publicidad_inicial_pen)
values ('GOLDEN', 3.78, 7200, 800, 200, 500, 1000, 200, 300, 400, 1000, 2000, 200);
insert into test.ids select 'lote', id from public.import_batches;
insert into test.ids select 'm48', id from public.vehicle_models where codigo_modelo = 'TEST-48';
insert into test.ids select 'm72', id from public.vehicle_models where codigo_modelo = 'TEST-72';
insert into public.batch_items (batch_id, model_id, cantidad_packing_list)
values (test.id('lote'), test.id('m48'), 6), (test.id('lote'), test.id('m72'), 2);

select test.guardar();
do $$ begin assert test.filas() = 2, 'costeo guardado'; end $$;

-- Cambios que NO afectan el prorrateo: el costeo se conserva
update public.import_batches set notas = 'llegó con retraso', nro_dam = '118-2026-10-361056-01-0-00',
  fecha_llegada = '2026-10-01', estado = 'en_almacen' where id = test.id('lote');
update public.batch_items set cantidad_dam = 6 where model_id = test.id('m48');
update public.import_batches set fob_total_usd = 7200 where id = test.id('lote');   -- mismo valor
do $$ begin assert test.filas() = 2, 'notas, DAM, fechas, estado y cantidad DAM no invalidan el costeo'; end $$;
\echo '✔ 1. D21: los cambios que no entran al prorrateo conservan el costeo'

-- Cambio de un monto del lote → se borra
update public.import_batches set fob_total_usd = 7300 where id = test.id('lote');
do $$ begin assert test.filas() = 0, 'cambiar el FOB invalida el costeo'; end $$;
select test.expect_error($$update public.import_batches set estado = 'liquidado' where id = test.id('lote')$$,
  'sin costeo vigente');

-- Volver al valor original y recostear
update public.import_batches set fob_total_usd = 7200 where id = test.id('lote');
select test.guardar();
update public.import_batches set impuestos_recuperables_al_costo = false where id = test.id('lote');
do $$ begin assert test.filas() = 0, 'el interruptor RN-05 invalida el costeo'; end $$;
update public.import_batches set impuestos_recuperables_al_costo = true where id = test.id('lote');
select test.guardar();
update public.import_batches set tipo_cambio = 3.80 where id = test.id('lote');
do $$ begin assert test.filas() = 0, 'el tipo de cambio invalida el costeo'; end $$;
update public.import_batches set tipo_cambio = 3.78 where id = test.id('lote');
\echo '✔ 2. D21: cambiar un monto, el interruptor RN-05 o el TC borra el costeo y RN-07 impide liquidar'

-- Packing list: cambio de EXW, alta y baja
select test.guardar();
update public.batch_items set exw_usd_unitario = 301 where model_id = test.id('m48');
do $$ begin assert test.filas() = 0, 'cambiar el EXW de una línea invalida el costeo'; end $$;
update public.batch_items set exw_usd_unitario = 300 where model_id = test.id('m48');
select test.guardar();
delete from public.batch_items where model_id = test.id('m72');
do $$ begin assert test.filas() = 0, 'quitar una línea invalida todo el costeo'; end $$;
insert into public.batch_items (batch_id, model_id, cantidad_packing_list) values (test.id('lote'), test.id('m72'), 2);
select test.guardar();
\echo '✔ 3. D21: cambios en el packing list (EXW, alta, baja) borran el costeo'

-- Liquidado: el costeo queda (no se puede tocar) y reabrir no lo borra
update public.import_batches set estado = 'liquidado' where id = test.id('lote');
do $$ begin
  assert test.filas() = 2, 'liquidado conserva el costeo';
  assert (select count(*) from public.price_list where batch_id = test.id('lote')) = 6, 'genera precios';
end $$;
update public.import_batches set notas = 'nota en liquidado' where id = test.id('lote');
update public.import_batches set estado = 'en_almacen' where id = test.id('lote');
do $$ begin assert test.filas() = 2, 'reabrir no borra el costeo'; end $$;
update public.import_batches set estado = 'liquidado' where id = test.id('lote');
\echo '✔ 4. Liquidar y reabrir conservan el costeo vigente'
\echo ''
\echo 'TODAS LAS PRUEBAS DE invalidar_costeo PASARON'
