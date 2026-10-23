-- =============================================================================
-- Pruebas de la RPC mover_unidades (D40): admin y técnico cambian solo la ubicación, de una o
-- varias motos (todas o ninguna); una vendida no se mueve; una en tienda no queda sin ubicación;
-- cada movimiento queda en movimientos_ubicacion (desde, hacia, quién y cuándo).
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

insert into public.locations (nombre, tipo) values ('MU Almacén', 'almacen'), ('MU Showroom', 'showroom'), ('MU Cerrada', 'almacen');
update public.locations set activo = false where nombre = 'MU Cerrada';
insert into test.ids select nombre, id from public.locations where nombre like 'MU %';

insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('MU-48', 'bicimoto', 48, 20, 500, 0.5, 300);
insert into public.import_batches (codigo_embarque, tipo_cambio) values ('MU-LOTE', 3.78);
insert into test.ids select 'lote', id from public.import_batches where codigo_embarque = 'MU-LOTE';
insert into test.ids select codigo_modelo, id from public.vehicle_models;
insert into public.batch_items (batch_id, model_id, cantidad_packing_list) values (test.id('lote'), test.id('MU-48'), 4);

insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor, location_id) values
  (test.id('lote'), test.id('MU-48'), 'VINUNO', 'MOTUNO', test.id('MU Almacén')),
  (test.id('lote'), test.id('MU-48'), 'VINDOS', 'MOTDOS', test.id('MU Almacén')),
  (test.id('lote'), test.id('MU-48'), 'VINTIENDA', 'MOTTIENDA', test.id('MU Showroom')),
  (test.id('lote'), test.id('MU-48'), 'VINVENDIDA', 'MOTVENDIDA', test.id('MU Showroom'));
insert into test.ids select vin_chasis, id from public.vehicle_inventory;

-- Estados de preparación sin pasar por el taller ni por una orden de venta
reset role;
set session_replication_role = replica;
update public.vehicle_inventory set estado = 'listo_en_tienda' where id = test.id('VINTIENDA');
update public.vehicle_inventory set estado = 'vendido' where id = test.id('VINVENDIDA');
set session_replication_role = default;
set role authenticated;

do $$ begin
  assert (select count(*) from public.movimientos_ubicacion where vehicle_id = test.id('VINUNO')
            and desde_location_id is null and hacia_location_id = test.id('MU Almacén')
            and movido_por = test.id('admin@ev.pe')) = 1, 'el registro con ubicación queda en el historial';
end $$;
\echo '✔ 1. Registrar una moto con ubicación queda como primer movimiento'

-- ---------------------------------------------------------------- 2. Permisos
select test.como('vendedor@ev.pe');
select test.expect_error($$select public.mover_unidades(array[test.id('VINUNO')], test.id('MU Showroom'))$$,
  'Solo un administrador o un técnico puede mover motos');
do $$ begin
  assert (select count(*) from public.movimientos_ubicacion) = 0, 'el vendedor no ve el historial';
end $$;
reset role;
set role anon;
select test.expect_error($$select public.mover_unidades(null, null)$$, 'permission denied');
reset role;
do $$ begin
  assert not has_function_privilege('anon', 'public.mover_unidades(uuid[], uuid)', 'execute'), 'anon sin EXECUTE';
  assert has_function_privilege('authenticated', 'public.mover_unidades(uuid[], uuid)', 'execute'), 'authenticated con EXECUTE';
  assert (select prosecdef from pg_proc where oid = 'public.mover_unidades(uuid[], uuid)'::regprocedure), 'security definer';
  assert (select proconfig @> array['search_path=""'] from pg_proc
          where oid = 'public.mover_unidades(uuid[], uuid)'::regprocedure), 'search_path vacío';
  assert (select relrowsecurity from pg_class where oid = 'public.movimientos_ubicacion'::regclass), 'RLS activo';
end $$;
set role authenticated;
select test.como('tecnico@ev.pe');
select test.expect_error($$insert into public.movimientos_ubicacion (vehicle_id, hacia_location_id)
  values (test.id('VINUNO'), test.id('MU Showroom'))$$, 'row-level security');
\echo '✔ 2. D40: vendedor y anon no mueven motos; el historial no se escribe a mano'

-- ---------------------------------------------------------------- 3. Técnico mueve varias
do $$ begin
  assert public.mover_unidades(array[test.id('VINUNO'), test.id('VINDOS'), test.id('VINUNO')], test.id('MU Showroom')) = 2,
    'mueve las dos (sin contar repetidos)';
  assert (select count(*) from public.vehicle_inventory
          where id in (test.id('VINUNO'), test.id('VINDOS')) and location_id = test.id('MU Showroom')) = 2, 'ambas movidas';
  assert (select count(*) from public.movimientos_ubicacion
          where vehicle_id in (test.id('VINUNO'), test.id('VINDOS'))
            and desde_location_id = test.id('MU Almacén') and hacia_location_id = test.id('MU Showroom')
            and movido_por = test.id('tecnico@ev.pe') and movido_at is not null) = 2, 'historial desde/hacia/quién';
  -- Mover a donde ya está no cuenta ni deja historial
  assert public.mover_unidades(array[test.id('VINUNO')], test.id('MU Showroom')) = 0, 'sin cambios';
  assert (select count(*) from public.movimientos_ubicacion where vehicle_id = test.id('VINUNO')) = 2, 'sin movimiento extra';
end $$;
\echo '✔ 3. El técnico mueve varias motos a la vez y queda el historial (desde, hacia, quién y cuándo)'

-- ---------------------------------------------------------------- 4. Todo o nada
select test.expect_error($$select public.mover_unidades(array[test.id('VINUNO'), test.id('VINVENDIDA')], test.id('MU Almacén'))$$,
  'La moto VINVENDIDA ya está vendida');
select test.expect_error($$select public.mover_unidades(array[test.id('VINUNO'), gen_random_uuid()], test.id('MU Almacén'))$$,
  'Alguna de las motos no existe');
do $$ begin
  assert (select location_id from public.vehicle_inventory where id = test.id('VINUNO')) = test.id('MU Showroom'),
    'ninguna se movió';
end $$;
select test.expect_error($$select public.mover_unidades(array[test.id('VINUNO')], test.id('MU Cerrada'))$$, 'Elige una ubicación activa');
select test.expect_error($$select public.mover_unidades(array[test.id('VINUNO')], null)$$, 'Elige una ubicación activa');
select test.expect_error($$select public.mover_unidades(array[]::uuid[], test.id('MU Almacén'))$$, 'Selecciona al menos una moto');
\echo '✔ 4. D40: si una moto no se puede mover (vendida o inexistente), no se mueve ninguna'

-- ---------------------------------------------------------------- 5. Reglas por cualquier vía
-- Una vendida tampoco con un UPDATE directo, ni siquiera el admin
select test.como('admin@ev.pe');
select test.expect_error($$update public.vehicle_inventory set location_id = test.id('MU Almacén') where id = test.id('VINVENDIDA')$$,
  'ya está vendida');
select test.expect_error($$select public.mover_unidades(array[test.id('VINVENDIDA')], test.id('MU Almacén'))$$, 'ya está vendida');
-- Una moto en tienda no queda sin ubicación
select test.como('tecnico@ev.pe');
select test.expect_error($$update public.vehicle_inventory set location_id = null where id = test.id('VINTIENDA')$$,
  'debe tener una ubicación');
-- Una en tienda sí cambia de ubicación (y otra que no está en tienda sí puede quedar sin ubicación)
select public.mover_unidades(array[test.id('VINTIENDA')], test.id('MU Almacén'));
update public.vehicle_inventory set location_id = null where id = test.id('VINDOS');
do $$ begin
  assert (select location_id from public.vehicle_inventory where id = test.id('VINTIENDA')) = test.id('MU Almacén'), 'tienda movida';
  assert (select count(*) from public.movimientos_ubicacion where vehicle_id = test.id('VINDOS')
            and desde_location_id = test.id('MU Showroom') and hacia_location_id is null) = 1, 'UPDATE directo también al historial';
end $$;
\echo '✔ 5. Por cualquier vía: una vendida no se mueve y una en tienda no queda sin ubicación'

\echo 'TODAS LAS PRUEBAS DE mover_unidades PASARON'
