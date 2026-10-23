-- =============================================================================
-- Origen del lote en las vistas (D41, 17.6, migración origen_lote_vistas)
-- v_stock trae tipo_lote para todos los roles (vía origen_lote, security definer), pero nunca el
-- proveedor ni costos; v_vehicle_costs y v_sales_margin (solo admin) traen tipo_lote y proveedor.
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values
  (gen_random_uuid(), 'admin@ev.pe',   '{"nombre":"Ana Admin"}'),
  (gen_random_uuid(), 'ventas@ev.pe',  '{"nombre":"Vero Ventas"}'),
  (gen_random_uuid(), 'taller@ev.pe',  '{"nombre":"Tito Técnico"}'),
  (gen_random_uuid(), 'nadie@ev.pe',   '{"nombre":"Sin Rol"}');
update public.profiles p set rol = x.rol::public.app_role
from (values ('admin@ev.pe','admin'), ('ventas@ev.pe','vendedor'), ('taller@ev.pe','tecnico')) x(email, rol)
join auth.users u on u.email = x.email where p.id = u.id;

set role authenticated;
select test.como('admin@ev.pe');

-- ---------------------------------------------------------------- una importación y una compra local liquidadas
insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('TEST-48', 'bicimoto', 48, 20, 500, 0.50, 300);
insert into test.ids select 'm48', id from public.vehicle_models where codigo_modelo = 'TEST-48';
insert into test.ids select 'showroom', id from public.locations where nombre = 'Showroom Piérola';
insert into public.proveedores (nombre) values ('Tianjin Test');
insert into public.proveedores (nombre, ruc) values ('Luna Importaciones', '20123456789');
insert into test.ids select 'tianjin', id from public.proveedores where nombre = 'Tianjin Test';
insert into test.ids select 'luna', id from public.proveedores where nombre = 'Luna Importaciones';

insert into public.import_batches (codigo_embarque, tipo_cambio, proveedor_id) values ('IMP-1', 3.78, test.id('tianjin'));
insert into public.import_batches (codigo_embarque, tipo_lote, tipo_cambio, proveedor_id, nro_factura, fecha_compra)
values ('CL-1', 'compra_local', 1, test.id('luna'), 'F001-1', '2026-10-20');
insert into test.ids select 'imp', id from public.import_batches where codigo_embarque = 'IMP-1';
insert into test.ids select 'cl', id from public.import_batches where codigo_embarque = 'CL-1';

insert into public.batch_items (batch_id, model_id, cantidad_packing_list) values (test.id('imp'), test.id('m48'), 1);
insert into public.batch_items (batch_id, model_id, cantidad_packing_list, precio_compra_unitario_pen)
values (test.id('cl'), test.id('m48'), 1, 1180);
insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor)
values (test.id('imp'), test.id('m48'), 'IMPVIN1', 'IMPMOT1'), (test.id('cl'), test.id('m48'), 'CLVIN1', 'CLMOT1');
insert into public.vehicle_batteries (vehicle_id, serial, posicion)
select v.id, 'BAT-' || v.vin_chasis || '-' || p, p from public.vehicle_inventory v cross join generate_series(1, 4) p;
update public.vehicle_inventory set estado = 'en_ensamble';
insert into public.technical_inspections (vehicle_id, baterias_esperadas, baterias_contadas, voltaje_medido, vin_verificado, motor_verificado, checklist)
select id, 0, 4, 51.2, true, true, '{"frenos":true,"luces":true}' from public.vehicle_inventory;
update public.vehicle_inventory set estado = 'listo_en_tienda', location_id = test.id('showroom');

insert into public.batch_model_costs (batch_id, model_id, cantidad, tipo_cambio, fob_asignado_usd)
values (test.id('imp'), test.id('m48'), 1, 3.78, 300);
insert into public.batch_model_costs (batch_id, model_id, cantidad, tipo_cambio, compra_asignada_pen, impuestos_asignados_pen)
values (test.id('cl'), test.id('m48'), 1, 1, 1000, 180);
update public.import_batches set estado = 'liquidado';

-- ---------------------------------------------------------------- 1. v_stock: origen para todos, sin proveedor
do $$ begin
  assert (select tipo_lote from public.v_stock where vin_chasis = 'IMPVIN1') = 'importacion', 'admin: importación';
  assert (select tipo_lote from public.v_stock where vin_chasis = 'CLVIN1') = 'compra_local', 'admin: compra local';
  assert not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'v_stock'
                     and (column_name like '%proveedor%' or column_name like '%costo%')), 'v_stock sin proveedor ni costos';
end $$;

select test.como('ventas@ev.pe');
do $$ begin
  assert (select count(*) from public.import_batches) = 0, 'el vendedor no lee lotes';
  assert (select tipo_lote from public.v_stock where vin_chasis = 'CLVIN1') = 'compra_local', 'vendedor: compra local';
  assert (select count(*) from public.v_stock where tipo_lote = 'importacion') = 1, 'vendedor filtra por origen';
  assert (select count(*) from public.v_vehicle_costs) = 0, 'vendedor sin costos';
end $$;

select test.como('taller@ev.pe');
do $$ begin
  assert (select tipo_lote from public.v_stock where vin_chasis = 'IMPVIN1') = 'importacion', 'técnico: importación';
  assert (select count(*) from public.v_vehicle_costs) = 0, 'técnico sin costos';
end $$;

select test.como('nadie@ev.pe');
do $$ begin
  assert public.origen_lote(test.id('cl')) is null, 'sin rol: sin origen';
end $$;
\echo '✔ 1. D41: v_stock trae el origen para admin, vendedor y técnico (sin proveedor ni costos); sin rol, nada'

-- ---------------------------------------------------------------- 2. vistas de costos con origen y proveedor
select test.como('ventas@ev.pe');
insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento)
values ('Juan Pérez', 'DNI', '45678912');
insert into test.ids select 'o1', id from public.sales_orders where cliente_documento = '45678912';
insert into public.order_items (order_id, vehicle_id)
select test.id('o1'), id from public.vehicle_inventory where vin_chasis = 'CLVIN1';
insert into public.payments (order_id, metodo, monto_pen)
select test.id('o1'), 'efectivo', sum(precio_unitario_pen) from public.order_items where order_id = test.id('o1');
update public.sales_orders set estado = 'confirmada' where id = test.id('o1');
do $$ begin
  assert (select count(*) from public.v_sales_margin) = 0, 'vendedor sin márgenes';
end $$;

select test.como('admin@ev.pe');
do $$ begin
  assert (select proveedor from public.v_vehicle_costs where vin_chasis = 'IMPVIN1') = 'Tianjin Test', 'costos: proveedor importación';
  assert (select tipo_lote::text || '|' || proveedor || '|' || costo_landing_calculado_pen
          from public.v_vehicle_costs where vin_chasis = 'CLVIN1') = 'compra_local|Luna Importaciones|1180.00', 'costos: compra local';
  assert (select tipo_lote::text || '|' || proveedor_id::text || '|' || proveedor
          from public.v_sales_margin where order_id = test.id('o1'))
         = 'compra_local|' || test.id('luna')::text || '|Luna Importaciones', 'margen con origen y proveedor';
  assert (select costo_landing_unitario_pen from public.v_sales_margin where order_id = test.id('o1')) = 1180.00, 'margen: costo';
end $$;
\echo '✔ 2. D41: v_vehicle_costs y v_sales_margin (solo admin) traen origen y proveedor'
