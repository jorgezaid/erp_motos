-- =============================================================================
-- Escalas de venta activas (D31, migración escalas_activas)
-- Una orden no se crea, no cambia de tipo ni se confirma con una escala inactiva; anular y
-- editar el contacto siguen permitidos; la lista de precios conserva las 3 escalas y
-- activar/desactivar no regenera precios.
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values
  (gen_random_uuid(), 'admin@ev.pe',  '{"nombre":"Ana Admin"}'),
  (gen_random_uuid(), 'ventas@ev.pe', '{"nombre":"Vero Ventas"}');
update public.profiles p set rol = x.rol::public.app_role
from (values ('admin@ev.pe','admin'), ('ventas@ev.pe','vendedor')) x(email, rol)
join auth.users u on u.email = x.email where p.id = u.id;

set role authenticated;
select test.como('admin@ev.pe');

do $$ begin
  assert (select activo from public.price_margins where tipo_venta = 'unidad_x1'), 'x1 activa';
  assert not (select activo from public.price_margins where tipo_venta = 'mayorista_x3'), 'x3 desactivada';
  assert not (select activo from public.price_margins where tipo_venta = 'distribuidor_x6'), 'x6 desactivada';
  assert (select margen_objetivo from public.price_margins where tipo_venta = 'unidad_x1') = 0.45, 'margen x1 sin cambios';
end $$;
\echo '✔ 1. x1 activa; x3 y x6 desactivadas; márgenes sin cambios'

-- ---------------------------------------------------------------- lote liquidado con 3 motos en tienda
insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('TEST-48', 'bicimoto', 48, 20, 500, 0.50, 300);
insert into public.import_batches (codigo_embarque, tipo_cambio) values ('LOTE-ESC', 3.78);
insert into test.ids select 'lote', id from public.import_batches where codigo_embarque = 'LOTE-ESC';
insert into test.ids select 'm48', id from public.vehicle_models where codigo_modelo = 'TEST-48';
insert into test.ids select 'showroom', id from public.locations where nombre = 'Showroom Piérola';

insert into public.batch_items (batch_id, model_id, cantidad_packing_list) values (test.id('lote'), test.id('m48'), 3);
insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor)
select test.id('lote'), test.id('m48'), 'ESC48VIN' || g, 'ESCMOT' || g from generate_series(1, 3) g;
insert into public.vehicle_batteries (vehicle_id, serial, posicion)
select v.id, 'BAT-' || v.vin_chasis || '-' || p, p
from public.vehicle_inventory v cross join generate_series(1, 4) p;
update public.vehicle_inventory set estado = 'en_ensamble';
insert into public.technical_inspections (vehicle_id, baterias_esperadas, baterias_contadas, voltaje_medido, vin_verificado, motor_verificado, checklist)
select id, 0, 4, 51.2, true, true, '{"frenos":true,"luces":true}' from public.vehicle_inventory;
update public.vehicle_inventory set estado = 'listo_en_tienda', location_id = test.id('showroom');

insert into public.batch_model_costs (batch_id, model_id, cantidad, tipo_cambio,
  fob_asignado_usd, flete_internacional_asignado_usd, gastos_agente_asignado_usd,
  impuestos_asignados_pen, flete_nacional_asignado_pen, alquiler_asignado_pen,
  sueldos_asignado_pen, publicidad_asignada_pen, armado_pen)
values (test.id('lote'), test.id('m48'), 3, 3.78, 900, 0, 0, 0, 0, 0, 0, 0, 0);
update public.import_batches set estado = 'liquidado' where id = test.id('lote');

do $$ begin
  assert (select count(*) from public.price_list where batch_id = test.id('lote')) = 3, 'precios x1, x3 y x6 generados';
  assert (select count(*) from public.price_list where tipo_venta in ('mayorista_x3', 'distribuidor_x6')) = 2,
    'la lista conserva x3 y x6 aunque estén desactivadas';
end $$;
\echo '✔ 2. generar_lista_precios sigue generando las 3 escalas'

-- ---------------------------------------------------------------- escala inactiva: crear y cambiar
select test.como('ventas@ev.pe');
select test.expect_error($$insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento, tipo_venta)
  values ('Mayorista SAC', 'RUC', '20601234567', 'mayorista_x3')$$,
  'La venta mayorista (x3) está desactivada; solo se puede vender por unidad (x1).');

insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento)
values ('Juan Pérez', 'DNI', '45678912');
insert into test.ids select 'o1', id from public.sales_orders where cliente_documento = '45678912';
select test.expect_error($$update public.sales_orders set tipo_venta = 'distribuidor_x6' where id = test.id('o1')$$,
  'La venta distribuidor (x6) está desactivada');
do $$ begin
  assert (select tipo_venta from public.sales_orders where id = test.id('o1')) = 'unidad_x1', 'sigue en x1';
end $$;

-- El vendedor no puede activar una escala (RLS filtra en silencio)
update public.price_margins set activo = true where tipo_venta = 'mayorista_x3';
do $$ begin
  assert not (select activo from public.price_margins where tipo_venta = 'mayorista_x3'), 'vendedor no activa escalas';
end $$;
\echo '✔ 3. Crear o cambiar a una escala inactiva → error; el vendedor no activa escalas'

-- ---------------------------------------------------------------- confirmar con escala inactiva
select test.como('admin@ev.pe');
update public.price_margins set activo = true where tipo_venta = 'mayorista_x3';

select test.como('ventas@ev.pe');
update public.sales_orders set tipo_venta = 'mayorista_x3' where id = test.id('o1');
insert into public.order_items (order_id, vehicle_id) select test.id('o1'), id from public.vehicle_inventory;
insert into public.payments (order_id, metodo, monto_pen)
select id, 'efectivo', total_pen from public.sales_orders where id = test.id('o1');

select test.como('admin@ev.pe');
update public.price_margins set activo = false where tipo_venta = 'mayorista_x3';

select test.como('ventas@ev.pe');
select test.expect_error($$update public.sales_orders set estado = 'confirmada' where id = test.id('o1')$$,
  'La venta mayorista (x3) está desactivada; solo se puede vender por unidad (x1).');
-- El borrador sigue editable (contacto, total) aunque su escala esté inactiva
update public.sales_orders set cliente_telefono = '999111222' where id = test.id('o1');
do $$ begin
  assert (select cliente_telefono from public.sales_orders where id = test.id('o1')) = '999111222', 'borrador editable';
  assert (select estado from public.sales_orders where id = test.id('o1')) = 'borrador', 'no se confirmó';
end $$;
\echo '✔ 4. Confirmar con una escala inactiva → error'

-- ---------------------------------------------------------------- reactivada → funciona
select test.como('admin@ev.pe');
update public.price_margins set activo = true where tipo_venta = 'mayorista_x3';
select test.como('ventas@ev.pe');
update public.sales_orders set estado = 'confirmada' where id = test.id('o1');
do $$ begin
  assert (select estado from public.sales_orders where id = test.id('o1')) = 'confirmada', 'confirma con x3 activa';
end $$;

-- Desactivada otra vez: editar el contacto y anular siguen permitidos
select test.como('admin@ev.pe');
update public.price_margins set activo = false where tipo_venta = 'mayorista_x3';
select test.como('ventas@ev.pe');
update public.sales_orders set cliente_email = 'juan@correo.pe' where id = test.id('o1');
select test.como('admin@ev.pe');
update public.sales_orders set estado = 'anulada', motivo_anulacion = 'Prueba' where id = test.id('o1');
do $$ begin
  assert (select cliente_email from public.sales_orders where id = test.id('o1')) = 'juan@correo.pe', 'contacto editable';
  assert (select estado from public.sales_orders where id = test.id('o1')) = 'anulada', 'anular no se bloquea';
end $$;
\echo '✔ 5. Reactivada se confirma; desactivada no bloquea editar el contacto ni anular'

-- ---------------------------------------------------------------- mensaje con varias escalas activas
update public.price_margins set activo = true where tipo_venta = 'distribuidor_x6';
select test.como('ventas@ev.pe');
select test.expect_error($$insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento, tipo_venta)
  values ('Mayorista SAC', 'RUC', '20601234567', 'mayorista_x3')$$,
  'solo se puede vender por unidad (x1) o distribuidor (x6).');
select test.como('admin@ev.pe');
update public.price_margins set activo = false where tipo_venta = 'distribuidor_x6';
\echo '✔ 6. El mensaje lista las escalas activas'

-- ---------------------------------------------------------------- activar/desactivar no regenera precios
create temp table marca as select max(updated_at) as t from public.price_list;
update public.price_margins set activo = true where tipo_venta = 'distribuidor_x6';
update public.price_margins set activo = false where tipo_venta = 'distribuidor_x6';
do $$ begin
  assert (select max(updated_at) from public.price_list) = (select t from marca), 'activar/desactivar no toca price_list';
end $$;
update public.price_margins set margen_objetivo = 0.30 where tipo_venta = 'distribuidor_x6';
do $$ begin
  assert (select max(updated_at) from public.price_list) > (select t from marca), 'cambiar el margen sí regenera';
end $$;
\echo '✔ 7. Activar o desactivar no regenera precios; cambiar el margen sí'

-- ---------------------------------------------------------------- al menos una activa
select test.expect_error($$update public.price_margins set activo = false$$, 'al menos una escala');
do $$ begin
  assert (select activo from public.price_margins where tipo_venta = 'unidad_x1'), 'x1 sigue activa';
end $$;
\echo '✔ 8. Debe quedar al menos una escala activa'
\echo ''
\echo 'TODAS LAS PRUEBAS DE ESCALAS ACTIVAS PASARON'
