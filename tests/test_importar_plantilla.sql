-- =============================================================================
-- Pruebas de la RPC importar_plantilla (tarea 11.1, D33): solo admin, todo o nada,
-- reimportar sin duplicar ni borrar, y errores con hoja y fila.
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

-- Archivo de ejemplo: 1 ubicación nueva, 2 modelos nuevos, un lote, 2 líneas, 3 unidades y 4 baterías
create table test.plantilla (k text primary key, v jsonb);
grant all on test.plantilla to authenticated;
insert into test.plantilla values ('base', $json${
  "ubicaciones": [{"fila": 5, "nombre": "Showroom Arequipa", "tipo": "showroom", "direccion": "Av. Ejército 101"}],
  "modelos": [
    {"fila": 3, "codigo_modelo": "IMP-48", "nombre_comercial": "Urbana", "categoria": "bicimoto", "voltaje_sistema": 48,
     "amperaje_bateria_ah": 20, "potencia_motor_watts": 500, "volumen_cbm_unitario": "0.5000", "exw_usd_unitario": "300.00",
     "garantia_meses": 12, "garantia_baterias_meses": 6},
    {"fila": 4, "codigo_modelo": "IMP-60", "nombre_comercial": null, "categoria": "trimoto_carga", "voltaje_sistema": 60,
     "amperaje_bateria_ah": 32, "potencia_motor_watts": 1000, "volumen_cbm_unitario": "1.2000", "exw_usd_unitario": "650.00",
     "garantia_meses": null, "garantia_baterias_meses": null}],
  "lote": {"codigo_embarque": "IMP-LOTE-1", "nro_dam": "118-IMP-1", "proveedor": "Proveedor SAC",
           "fecha_embarque": "2026-09-01", "fecha_llegada": "2026-10-01", "tipo_cambio": "3.7800",
           "fob_total_usd": "1600.00", "flete_internacional_usd": "500.00", "gastos_agente_usd": null,
           "ad_valorem_pen": null, "igv_pen": "900.00", "ipm_pen": null, "percepcion_pen": null,
           "flete_nacional_pen": null, "alquiler_periodo_pen": null, "sueldos_periodo_pen": null,
           "publicidad_inicial_pen": null, "costo_armado_unitario_pen": "60.00"},
  "packing": [
    {"fila": 2, "codigo_modelo": "IMP-48", "cantidad_packing_list": 2, "cantidad_dam": 2, "exw_usd_unitario": null},
    {"fila": 3, "codigo_modelo": "IMP-60", "cantidad_packing_list": 1, "cantidad_dam": null, "exw_usd_unitario": "640.00"}],
  "unidades": [
    {"fila": 3, "vin_chasis": "IMPVIN001", "nro_motor": "IMPMOT001", "codigo_modelo": "IMP-48", "color_primario": "Rojo", "color_secundario": null, "notas": null},
    {"fila": 4, "vin_chasis": "IMPVIN002", "nro_motor": "IMPMOT002", "codigo_modelo": "IMP-48", "color_primario": null, "color_secundario": null, "notas": null},
    {"fila": 5, "vin_chasis": "IMPVIN003", "nro_motor": "IMPMOT003", "codigo_modelo": "IMP-60", "color_primario": "Azul", "color_secundario": "Negro", "notas": "Golpe en la caja"}],
  "baterias": [
    {"fila": 3, "vin_chasis": "IMPVIN001", "serial": "BAT-001", "posicion": 1},
    {"fila": 3, "vin_chasis": "IMPVIN001", "serial": "BAT-002", "posicion": 2},
    {"fila": 3, "vin_chasis": "IMPVIN001", "serial": "BAT-003", "posicion": 3},
    {"fila": 3, "vin_chasis": "IMPVIN001", "serial": "BAT-004", "posicion": 4}]
}$json$);

set role authenticated;

-- ---------------------------------------------------------------- 1. Solo admin
select test.como('tecnico@ev.pe');
select test.expect_error($$select public.importar_plantilla((select v from test.plantilla where k = 'base'))$$,
  'Solo un administrador puede importar');
select test.como('vendedor@ev.pe');
select test.expect_error($$select public.importar_plantilla((select v from test.plantilla where k = 'base'))$$,
  'Solo un administrador puede importar');
reset role;
set role anon;
select test.expect_error($$select public.importar_plantilla('{}'::jsonb)$$, 'permission denied');
reset role;
do $$ begin
  assert not has_function_privilege('anon', 'public.importar_plantilla(jsonb)', 'execute'), 'anon sin EXECUTE';
  assert has_function_privilege('authenticated', 'public.importar_plantilla(jsonb)', 'execute'), 'authenticated con EXECUTE';
  assert (select prosecdef from pg_proc where oid = 'public.importar_plantilla(jsonb)'::regprocedure) = false,
    'security invoker';
  assert not exists (select 1 from public.import_batches), 'nada importado';
end $$;
set role authenticated;
\echo '✔ 1. D33: solo el admin importa (técnico, vendedor y anon rechazados); security invoker'

-- ---------------------------------------------------------------- 2. Importación completa
select test.como('admin@ev.pe');
create temp table resultado as select public.importar_plantilla((select v from test.plantilla where k = 'base')) r;
do $$
declare r jsonb := (select r from resultado);
begin
  assert (r -> 'lote' ->> 'creado')::boolean, 'lote creado';
  assert (r -> 'ubicaciones' ->> 'creadas')::int = 1, 'ubicaciones creadas';
  assert (r -> 'modelos' ->> 'creados')::int = 2, 'modelos creados';
  assert (r -> 'packing' ->> 'creadas')::int = 2, 'líneas creadas';
  assert (r -> 'unidades' ->> 'creadas')::int = 3, 'unidades creadas';
  assert (r -> 'baterias' ->> 'creadas')::int = 4, 'baterías creadas';

  assert (select count(*) from public.vehicle_inventory where estado = 'en_caja') = 3, 'unidades en caja';
  assert (select tipo_cambio from public.import_batches where codigo_embarque = 'IMP-LOTE-1') = 3.78, 'TC';
  assert (select estado from public.import_batches where codigo_embarque = 'IMP-LOTE-1') = 'en_transito', 'estado inicial';
  assert (select garantia_meses from public.vehicle_models where codigo_modelo = 'IMP-60') = 12, 'garantía por defecto';
  -- EXW de la línea: el del catálogo si la factura está vacía; el de la factura si no
  assert (select i.exw_usd_unitario from public.batch_items i join public.vehicle_models m on m.id = i.model_id
          where m.codigo_modelo = 'IMP-48') = 300, 'EXW del catálogo';
  assert (select i.exw_usd_unitario from public.batch_items i join public.vehicle_models m on m.id = i.model_id
          where m.codigo_modelo = 'IMP-60') = 640, 'EXW de la factura';
  assert not exists (select 1 from public.batch_model_costs), 'no guarda costeo';
end $$;
drop table resultado;
\echo '✔ 2. D33: importa ubicaciones, modelos, lote, packing, unidades en caja y baterías; no costea'

-- ---------------------------------------------------------------- 3. Reimportar sin duplicar ni borrar
create temp table resultado as select public.importar_plantilla((select v from test.plantilla where k = 'base')) r;
do $$
declare r jsonb := (select r from resultado);
begin
  assert not (r -> 'lote' ->> 'creado')::boolean and not (r -> 'lote' ->> 'actualizado')::boolean, 'lote sin cambios';
  assert (r -> 'modelos' ->> 'creados')::int + (r -> 'modelos' ->> 'actualizados')::int = 0, 'modelos sin cambios';
  assert (r -> 'unidades' ->> 'creadas')::int + (r -> 'unidades' ->> 'actualizadas')::int = 0, 'unidades sin cambios';
  assert (r -> 'baterias' ->> 'creadas')::int = 0, 'baterías sin cambios';
  assert (select count(*) from public.vehicle_inventory) = 3, 'sin duplicar unidades';
  assert (select count(*) from public.vehicle_batteries) = 4, 'sin duplicar baterías';
  assert (select count(*) from public.locations where nombre = 'Showroom Arequipa') = 1, 'sin duplicar ubicaciones';
end $$;
drop table resultado;

-- Archivo corregido: cambia un color y un monto; quita una unidad y una línea del archivo (no se borran)
update test.plantilla set v = jsonb_set(jsonb_set(v, '{unidades}', (v -> 'unidades') - 1), '{packing}', (v -> 'packing') - 1)
where k = 'base';
update test.plantilla set v = jsonb_set(jsonb_set(v, '{unidades,0,color_primario}', '"Verde"'),
    '{lote,flete_internacional_usd}', '"520.00"')
where k = 'base';
create temp table resultado as select public.importar_plantilla((select v from test.plantilla where k = 'base')) r;
do $$
declare r jsonb := (select r from resultado);
begin
  assert (r -> 'lote' ->> 'actualizado')::boolean, 'lote actualizado';
  assert (r -> 'unidades' ->> 'actualizadas')::int = 1, 'una unidad actualizada';
  assert (select color_primario from public.vehicle_inventory where vin_chasis = 'IMPVIN001') = 'Verde', 'color';
  assert (select color_primario from public.vehicle_inventory where vin_chasis = 'IMPVIN003') = 'Azul', 'otra unidad intacta';
  assert (select count(*) from public.vehicle_inventory) = 3, 'no borra la unidad ausente';
  assert (select count(*) from public.batch_items) = 2, 'no borra la línea ausente';
  assert (select flete_internacional_usd from public.import_batches) = 520, 'monto';
  assert (select igv_pen from public.import_batches) = 900, 'celda vacía: conserva el valor';
end $$;
drop table resultado;
\echo '✔ 3. D33: reimportar el archivo corregido actualiza lo que cambió, sin duplicar ni borrar'

-- ---------------------------------------------------------------- 4. Todo o nada, con hoja y fila
-- Una ubicación y un modelo nuevos, y una unidad cuyo motor ya existe: nada se guarda
insert into test.plantilla values ('falla', $json${
  "ubicaciones": [{"fila": 6, "nombre": "Almacén Sur", "tipo": "almacen", "direccion": null}],
  "modelos": [{"fila": 5, "codigo_modelo": "IMP-72", "nombre_comercial": null, "categoria": "bicimoto", "voltaje_sistema": 72,
     "amperaje_bateria_ah": 20, "potencia_motor_watts": 1500, "volumen_cbm_unitario": "0.6000", "exw_usd_unitario": "700.00",
     "garantia_meses": null, "garantia_baterias_meses": null}],
  "lote": {"codigo_embarque": "IMP-LOTE-2"},
  "packing": [{"fila": 2, "codigo_modelo": "IMP-72", "cantidad_packing_list": 2, "cantidad_dam": null, "exw_usd_unitario": null}],
  "unidades": [
    {"fila": 3, "vin_chasis": "IMPVIN101", "nro_motor": "IMPMOT101", "codigo_modelo": "IMP-72", "color_primario": null, "color_secundario": null, "notas": null},
    {"fila": 4, "vin_chasis": "IMPVIN102", "nro_motor": "IMPMOT001", "codigo_modelo": "IMP-72", "color_primario": null, "color_secundario": null, "notas": null}],
  "baterias": []
}$json$);
select test.expect_error($$select public.importar_plantilla((select v from test.plantilla where k = 'falla'))$$,
  'Hoja «Unidades», fila 4: El número de motor ya está registrado');
do $$ begin
  assert not exists (select 1 from public.locations where nombre = 'Almacén Sur'), 'ubicación revertida';
  assert not exists (select 1 from public.vehicle_models where codigo_modelo = 'IMP-72'), 'modelo revertido';
  assert not exists (select 1 from public.import_batches where codigo_embarque = 'IMP-LOTE-2'), 'lote revertido';
  assert not exists (select 1 from public.vehicle_inventory where vin_chasis = 'IMPVIN101'), 'unidad revertida';
end $$;

-- VIN de otro lote
update test.plantilla set v = jsonb_set(v, '{unidades,1}',
  '{"fila": 4, "vin_chasis": "IMPVIN002", "nro_motor": "IMPMOT102", "codigo_modelo": "IMP-72"}') where k = 'falla';
select test.expect_error($$select public.importar_plantilla((select v from test.plantilla where k = 'falla'))$$,
  'Hoja «Unidades», fila 4: El VIN IMPVIN002 ya está registrado en otro lote');

-- RN-04 (trigger): más unidades que el packing list
update test.plantilla set v = jsonb_set(jsonb_set(v, '{unidades,1}',
  '{"fila": 4, "vin_chasis": "IMPVIN102", "nro_motor": "IMPMOT102", "codigo_modelo": "IMP-72"}'),
  '{packing,0,cantidad_packing_list}', '1') where k = 'falla';
select test.expect_error($$select public.importar_plantilla((select v from test.plantilla where k = 'falla'))$$,
  'Hoja «Unidades», fila 4: El packing list declara 1 unidad(es)');

-- RN-01 (trigger): más baterías que voltaje/12 (IMP-48 lleva 4 y ya tiene 4)
update test.plantilla set v = jsonb_set(jsonb_set(v, '{packing,0,cantidad_packing_list}', '2'), '{baterias}',
  '[{"fila": 9, "vin_chasis": "IMPVIN101", "serial": "BAT-101", "posicion": 1}]') where k = 'falla';
select public.importar_plantilla((select v from test.plantilla where k = 'falla'));   -- ahora sí pasa
select test.expect_error($$select public.importar_plantilla(jsonb_set((select v from test.plantilla where k = 'base'),
  '{baterias}', '[{"fila": 3, "vin_chasis": "IMPVIN001", "serial": "BAT-005", "posicion": 5}]'))$$,
  'Hoja «Baterías (opcional)», fila 3: El modelo usa 4 baterías de 12V');
-- Serial ya registrado en otra unidad
select test.expect_error($$select public.importar_plantilla(jsonb_set((select v from test.plantilla where k = 'base'),
  '{baterias}', '[{"fila": 4, "vin_chasis": "IMPVIN002", "serial": "BAT-001", "posicion": 1}]'))$$,
  'Hoja «Baterías (opcional)», fila 4: El serial de batería BAT-001 ya está registrado en otra unidad');
-- CHECK de la BD: voltaje inválido
select test.expect_error($$select public.importar_plantilla(jsonb_set((select v from test.plantilla where k = 'base'),
  '{modelos,0,voltaje_sistema}', '36'))$$, 'Hoja «Modelos», fila 3: El voltaje debe ser 48V, 60V o 72V');
\echo '✔ 4. D33: todo o nada; los errores (de la RPC y de los triggers RN-01/RN-03/RN-04) dicen hoja y fila'

-- ---------------------------------------------------------------- 5. Lote liquidado
reset role;
set session_replication_role = replica;   -- solo para la prueba: liquida sin costeo
update public.import_batches set estado = 'liquidado' where codigo_embarque = 'IMP-LOTE-1';
set session_replication_role = origin;
set role authenticated;
select test.como('admin@ev.pe');
select test.expect_error($$select public.importar_plantilla((select v from test.plantilla where k = 'base'))$$,
  'Hoja «Lote»: El lote IMP-LOTE-1 está liquidado');
\echo '✔ 5. D33: un lote liquidado no se importa'
\echo ''
\echo 'TODAS LAS PRUEBAS DE importar_plantilla PASARON'
