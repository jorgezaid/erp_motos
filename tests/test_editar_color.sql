-- =============================================================================
-- Pruebas de la RPC editar_color_unidad (D39): admin y técnico cambian solo los colores,
-- normalizados a MAYÚSCULAS; una moto vendida solo la corrige el admin; queda quién y cuándo.
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

insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('EC-48', 'bicimoto', 48, 20, 500, 0.5, 300);
insert into public.import_batches (codigo_embarque, tipo_cambio) values ('EC-LOTE', 3.78);
insert into test.ids select 'lote', id from public.import_batches where codigo_embarque = 'EC-LOTE';
insert into test.ids select codigo_modelo, id from public.vehicle_models;
insert into public.batch_items (batch_id, model_id, cantidad_packing_list) values (test.id('lote'), test.id('EC-48'), 3);

-- Al registrar también se normaliza (Registro de unidades, importador)
insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor, color_primario, color_secundario) values
  (test.id('lote'), test.id('EC-48'), 'VINTALLER', 'MOTTALLER', '  rojo ', 'Negro'),
  (test.id('lote'), test.id('EC-48'), 'VINVENDIDA', 'MOTVENDIDA', 'AZUL', null),
  (test.id('lote'), test.id('EC-48'), 'VINVACIA', 'MOTVACIA', ' ', '');
insert into test.ids select vin_chasis, id from public.vehicle_inventory;

-- VINVENDIDA vendida: solo para preparar el caso, sin pasar por una orden de venta
reset role;
set session_replication_role = replica;
update public.vehicle_inventory set estado = 'vendido' where id = test.id('VINVENDIDA');
set session_replication_role = default;
set role authenticated;

do $$ begin
  assert (select (color_primario, color_secundario) = ('ROJO', 'NEGRO')
          from public.vehicle_inventory where id = test.id('VINTALLER')), 'INSERT normaliza';
  assert (select color_primario is null and color_secundario is null
          from public.vehicle_inventory where id = test.id('VINVACIA')), 'vacío → NULL';
  assert (select color_actualizado_por is null from public.vehicle_inventory where id = test.id('VINTALLER')),
    'el registro no cuenta como cambio de color';
end $$;
\echo '✔ 1. Al registrar, los colores quedan en MAYÚSCULAS y sin espacios (vacío → NULL)'

-- ---------------------------------------------------------------- 2. Permisos
select test.como('vendedor@ev.pe');
select test.expect_error($$select public.editar_color_unidad(test.id('VINTALLER'), 'azul', null)$$,
  'Solo un administrador o un técnico puede cambiar el color');
reset role;
set role anon;
select test.expect_error($$select public.editar_color_unidad(null, 'azul', null)$$, 'permission denied');
reset role;
do $$ begin
  assert not has_function_privilege('anon', 'public.editar_color_unidad(uuid, text, text)', 'execute'), 'anon sin EXECUTE';
  assert has_function_privilege('authenticated', 'public.editar_color_unidad(uuid, text, text)', 'execute'), 'authenticated con EXECUTE';
  assert (select prosecdef from pg_proc where oid = 'public.editar_color_unidad(uuid, text, text)'::regprocedure),
    'security definer';
  assert (select proconfig @> array['search_path=""'] from pg_proc
          where oid = 'public.editar_color_unidad(uuid, text, text)'::regprocedure), 'search_path vacío';
end $$;
set role authenticated;

select test.como('tecnico@ev.pe');
select test.expect_error($$select public.editar_color_unidad(test.id('VINVENDIDA'), 'verde', null)$$,
  'Solo un administrador puede corregir el color de una moto vendida');
-- Tampoco con un UPDATE directo (la política de UPDATE del técnico sigue abierta para el taller)
select test.expect_error($$update public.vehicle_inventory set color_primario = 'VERDE' where id = test.id('VINVENDIDA')$$,
  'Solo un administrador puede corregir el color de una moto vendida');
do $$ begin
  assert (select color_primario from public.vehicle_inventory where id = test.id('VINVENDIDA')) = 'AZUL', 'vendida intacta';
end $$;
\echo '✔ 2. D39: vendedor y anon rechazados; el técnico no corrige una moto vendida (ni por RPC ni por UPDATE)'

-- ---------------------------------------------------------------- 3. Técnico en el taller
select public.editar_color_unidad(test.id('VINTALLER'), '  gris   oscuro ', ' verde ');
do $$ begin
  assert (select (color_primario, color_secundario) = ('GRIS OSCURO', 'VERDE')
            and color_actualizado_por = test.id('tecnico@ev.pe') and color_actualizado_at is not null
          from public.vehicle_inventory where id = test.id('VINTALLER')), 'normalizado y auditado';
end $$;
select public.editar_color_unidad(test.id('VINTALLER'), 'ROJO', '');
do $$ begin
  assert (select color_secundario is null from public.vehicle_inventory where id = test.id('VINTALLER')), 'secundario vacío → NULL';
end $$;
select test.expect_error($$select public.editar_color_unidad(test.id('VINTALLER'), '   ', 'azul')$$, 'Indica el color primario');
select test.expect_error($$select public.editar_color_unidad(test.id('VINTALLER'), 'rojo', ' ROJO')$$,
  'El color secundario debe ser distinto del primario');
select test.expect_error($$select public.editar_color_unidad(test.id('VINTALLER'), repeat('x', 31), null)$$, 'máximo 30 caracteres');
select test.expect_error($$select public.editar_color_unidad(gen_random_uuid(), 'rojo', null)$$, 'La unidad no existe');
\echo '✔ 3. El técnico cambia el color en el taller: MAYÚSCULAS, quién y cuándo; primario obligatorio'

-- ---------------------------------------------------------------- 4. Admin sobre una moto vendida
select test.como('admin@ev.pe');
select public.editar_color_unidad(test.id('VINVENDIDA'), 'azul', 'blanco');
do $$ begin
  assert (select (color_primario, color_secundario, estado::text) = ('AZUL', 'BLANCO', 'vendido')
            and color_actualizado_por = test.id('admin@ev.pe')
          from public.vehicle_inventory where id = test.id('VINVENDIDA')), 'admin corrige la vendida';
end $$;
\echo '✔ 4. D39: el admin corrige el color de una moto vendida'

-- ---------------------------------------------------------------- 5. Solo colores y auditoría
select test.como('tecnico@ev.pe');
update public.vehicle_inventory
set estado = 'en_ensamble', color_actualizado_por = test.id('vendedor@ev.pe'), color_actualizado_at = now() - interval '1 year'
where id = test.id('VINTALLER');
do $$ begin
  assert (select color_actualizado_por = test.id('tecnico@ev.pe') and color_actualizado_at > now() - interval '1 hour'
          from public.vehicle_inventory where id = test.id('VINTALLER')), 'la auditoría no se escribe a mano';
end $$;
\echo '✔ 5. La auditoría del color no se puede escribir a mano'

\echo 'TODAS LAS PRUEBAS DE editar_color_unidad PASARON'
