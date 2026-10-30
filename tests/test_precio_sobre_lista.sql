-- =============================================================================
-- Precio final por encima del precio de lista (D43, migración precio_sobre_lista)
-- ajustar_precio_item acepta precio > lista con motivo (admin, vendedor y vendedor_tecnico)
-- hasta lista × (1 + aumento_max_lista) (30 % por defecto, lo cambia solo el admin; el tope
-- aplica también al admin). Los descuentos no cambian.
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values
  (gen_random_uuid(), 'admin@ev.pe',  '{"nombre":"Ana Admin"}'),
  (gen_random_uuid(), 'ventas@ev.pe', '{"nombre":"Vero Ventas"}'),
  (gen_random_uuid(), 'mixto@ev.pe',  '{"nombre":"Vicente Vendedor-Técnico"}');
update public.profiles p set rol = x.rol::public.app_role
from (values ('admin@ev.pe','admin'), ('ventas@ev.pe','vendedor'), ('mixto@ev.pe','vendedor_tecnico')) x(email, rol)
join auth.users u on u.email = x.email where p.id = u.id;

set role authenticated;
select test.como('admin@ev.pe');

-- ---------------------------------------------------------------- lote liquidado con 3 motos en tienda
-- Costo landing = 900 USD × 3.78 / 3 = S/ 1134.00; precio x1 (margen 45 %) = S/ 2061.82
-- Tope del 30 %: 2061.82 × 1.30 = 2680.366 → 2680.36 se acepta y 2680.37 no
insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('TEST-48', 'bicimoto', 48, 20, 500, 0.50, 300);
insert into public.import_batches (codigo_embarque, tipo_cambio) values ('LOTE-SOB', 3.78);
insert into test.ids select 'lote', id from public.import_batches where codigo_embarque = 'LOTE-SOB';
insert into test.ids select 'm48', id from public.vehicle_models where codigo_modelo = 'TEST-48';
insert into test.ids select 'showroom', id from public.locations where nombre = 'Showroom Piérola';

insert into public.batch_items (batch_id, model_id, cantidad_packing_list) values (test.id('lote'), test.id('m48'), 3);
insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor)
select test.id('lote'), test.id('m48'), 'SOB48VIN' || g, 'SOBMOT' || g from generate_series(1, 3) g;
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
  assert (select precio_venta_pen from public.price_list where batch_id = test.id('lote') and tipo_venta = 'unidad_x1') = 2061.82, 'precio x1';
end $$;

-- ---------------------------------------------------------------- configuración: 30 %, solo la cambia el admin
do $$ begin
  assert (select aumento_max_lista from public.configuracion_ventas) = 0.30, 'por defecto 30 %';
end $$;
select test.como('ventas@ev.pe');
update public.configuracion_ventas set aumento_max_lista = 1;
do $$ begin
  assert (select aumento_max_lista from public.configuracion_ventas) = 0.30, 'el vendedor no cambia el tope (RLS)';
end $$;
select test.como('mixto@ev.pe');
update public.configuracion_ventas set aumento_max_lista = 1;
do $$ begin
  assert (select aumento_max_lista from public.configuracion_ventas) = 0.30, 'el vendedor_tecnico no cambia el tope (RLS)';
end $$;
select test.como('admin@ev.pe');
select test.expect_error($$update public.configuracion_ventas set aumento_max_lista = 0$$, 'aumento_max_lista');
select test.expect_error($$update public.configuracion_ventas set aumento_max_lista = 1.5$$, 'aumento_max_lista');
update public.configuracion_ventas set aumento_max_lista = 0.20;
do $$ begin
  assert (select aumento_max_lista from public.configuracion_ventas) = 0.20, 'el admin cambia el tope';
end $$;
update public.configuracion_ventas set aumento_max_lista = 0.30;
\echo '✔ 1. tope sobre la lista: 30 % por defecto, solo lo cambia el admin'

-- ---------------------------------------------------------------- una orden por rol
select test.como('ventas@ev.pe');
insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento) values ('Juan Pérez', 'DNI', '45678912');
insert into test.ids select 'ov', id from public.sales_orders where cliente_documento = '45678912';
insert into public.order_items (order_id, vehicle_id) select test.id('ov'), id from public.vehicle_inventory where vin_chasis = 'SOB48VIN1';
insert into test.ids select 'iv', oi.id from public.order_items oi where oi.order_id = test.id('ov');

select test.como('mixto@ev.pe');
insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento) values ('Rosa Díaz', 'DNI', '11223344');
insert into test.ids select 'om', id from public.sales_orders where cliente_documento = '11223344';
insert into public.order_items (order_id, vehicle_id) select test.id('om'), id from public.vehicle_inventory where vin_chasis = 'SOB48VIN2';
insert into test.ids select 'im', oi.id from public.order_items oi where oi.order_id = test.id('om');

select test.como('admin@ev.pe');
insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento) values ('Luis Soto', 'DNI', '87654321');
insert into test.ids select 'oa', id from public.sales_orders where cliente_documento = '87654321';
insert into public.order_items (order_id, vehicle_id) select test.id('oa'), id from public.vehicle_inventory where vin_chasis = 'SOB48VIN3';
insert into test.ids select 'ia', oi.id from public.order_items oi where oi.order_id = test.id('oa');

-- ---------------------------------------------------------------- vendedor: sobre la lista con motivo
select test.como('ventas@ev.pe');
select test.expect_error($$select public.ajustar_precio_item(test.id('ov'), jsonb_build_array(jsonb_build_object('item_id', test.id('iv'), 'precio', 2300)), null)$$,
  'Indica el motivo del precio sobre la lista');
select test.expect_error($$select public.ajustar_precio_item(test.id('ov'), jsonb_build_array(jsonb_build_object('item_id', test.id('iv'), 'precio', 2300)), ' ok ')$$,
  'Indica el motivo del precio sobre la lista');
do $$ begin
  assert (select precio_unitario_pen from public.order_items where id = test.id('iv')) = 2061.82, 'sin motivo no cambia';
end $$;
select public.ajustar_precio_item(test.id('ov'), jsonb_build_array(jsonb_build_object('item_id', test.id('iv'), 'precio', 2300)), 'Cliente pagó de más');
do $$ begin
  assert (select precio_unitario_pen from public.order_items where id = test.id('iv')) = 2300.00, 'precio sobre la lista';
  assert (select precio_lista_pen from public.order_items where id = test.id('iv')) = 2061.82, 'la lista no cambia';
  assert (select motivo_ajuste from public.order_items where id = test.id('iv')) = 'Cliente pagó de más', 'motivo guardado';
  assert (select ajustado_por = auth.uid() and ajustado_at is not null from public.order_items where id = test.id('iv')), 'auditoría';
  assert (select total_pen from public.sales_orders where id = test.id('ov')) = 2300.00, 'total recalculado';
end $$;
\echo '✔ 2. precio mayor a la lista: con motivo se acepta y se audita; sin motivo se rechaza'

-- ---------------------------------------------------------------- tope del 30 %: nadie se lo salta
select test.expect_error($$select public.ajustar_precio_item(test.id('ov'), jsonb_build_array(jsonb_build_object('item_id', test.id('iv'), 'precio', 2680.37)), 'Cliente pagó de más')$$,
  'El precio supera en más de 30 % el precio de lista. Revisa el monto.');
select test.expect_error($$select public.ajustar_precio_item(test.id('ov'), jsonb_build_array(jsonb_build_object('item_id', test.id('iv'), 'precio', 26000)), 'Cliente pagó de más')$$,
  'supera en más de 30 %');
-- El vendedor intenta subir el tope y luego un UPDATE directo: RLS lo filtra
update public.configuracion_ventas set aumento_max_lista = 1;
select test.expect_error($$select public.ajustar_precio_item(test.id('ov'), jsonb_build_array(jsonb_build_object('item_id', test.id('iv'), 'precio', 2680.37)), 'Cliente pagó de más')$$,
  'supera en más de 30 %');
update public.order_items set precio_unitario_pen = 4000, motivo_ajuste = 'Directo' where id = test.id('iv');
do $$ begin
  assert (select precio_unitario_pen from public.order_items where id = test.id('iv')) = 2300.00, 'sin UPDATE directo (RLS)';
end $$;
select public.ajustar_precio_item(test.id('ov'), jsonb_build_array(jsonb_build_object('item_id', test.id('iv'), 'precio', 2680.36)), 'Cliente pagó de más');
do $$ begin
  assert (select precio_unitario_pen from public.order_items where id = test.id('iv')) = 2680.36, '30 % exacto se acepta';
end $$;

select test.como('mixto@ev.pe');
select public.ajustar_precio_item(test.id('om'), jsonb_build_array(jsonb_build_object('item_id', test.id('im'), 'precio', 2400)), 'Accesorios incluidos');
select test.expect_error($$select public.ajustar_precio_item(test.id('om'), jsonb_build_array(jsonb_build_object('item_id', test.id('im'), 'precio', 2680.37)), 'Accesorios incluidos')$$,
  'supera en más de 30 %');
do $$ begin
  assert (select precio_unitario_pen from public.order_items where id = test.id('im')) = 2400.00, 'vendedor_tecnico sobre la lista';
end $$;

select test.como('admin@ev.pe');
select test.expect_error($$select public.ajustar_precio_item(test.id('oa'), jsonb_build_array(jsonb_build_object('item_id', test.id('ia'), 'precio', 2680.37)), 'Error de tipeo')$$,
  'supera en más de 30 %');
-- Con otro tope, el mensaje lo nombra
update public.configuracion_ventas set aumento_max_lista = 0.15;
select test.expect_error($$select public.ajustar_precio_item(test.id('oa'), jsonb_build_array(jsonb_build_object('item_id', test.id('ia'), 'precio', 2400)), 'Pago anticipado')$$,
  'supera en más de 15 % el precio de lista');
update public.configuracion_ventas set aumento_max_lista = 0.30;
select public.ajustar_precio_item(test.id('oa'), jsonb_build_array(jsonb_build_object('item_id', test.id('ia'), 'precio', 2400)), 'Pago anticipado');
\echo '✔ 3. más del 30 % se rechaza para el vendedor, el vendedor_tecnico y el admin; el vendedor no puede saltárselo'

-- ---------------------------------------------------------------- descuentos sin cambios y volver a lista
select test.como('ventas@ev.pe');
select test.expect_error($$select public.ajustar_precio_item(test.id('ov'), jsonb_build_array(jsonb_build_object('item_id', test.id('iv'), 'precio', 1750)), 'Cliente frecuente')$$,
  'Descuentos mayores al 10%');
select public.ajustar_precio_item(test.id('ov'), jsonb_build_array(jsonb_build_object('item_id', test.id('iv'), 'precio', 2061.82)), null);
do $$ begin
  assert (select motivo_ajuste is null and ajustado_por is null from public.order_items where id = test.id('iv')), 'volver a lista borra el motivo';
end $$;
\echo '✔ 4. el límite de descuento del vendedor no cambia; volver a la lista borra el motivo'

-- ---------------------------------------------------------------- confirmar con el total sobre la lista
select test.como('mixto@ev.pe');
insert into public.payments (order_id, metodo, monto_pen) values (test.id('om'), 'efectivo', 2400);
update public.sales_orders set estado = 'confirmada' where id = test.id('om');
do $$ begin
  assert (select estado from public.sales_orders where id = test.id('om')) = 'confirmada', 'confirmada con 2400';
end $$;
select test.como('admin@ev.pe');
do $$ begin
  assert (select sum(precio_unitario_pen) from public.v_sales_margin where order_id = test.id('om')) = 2400, 'margen con el precio final';
end $$;
\echo '✔ 5. la venta se confirma con el precio sobre la lista y el margen lo usa'
