-- =============================================================================
-- Precio final con descuento (D38, RN-25, migración ajustar_precio_item)
-- ajustar_precio_item: ≤ precio de lista, ≥ costo landing, motivo si hay descuento, límite %
-- para el vendedor (configurable solo por el admin), todo o nada, sin revelar el costo al
-- vendedor; la re-cotización descarta los ajustes y la venta se confirma con el total ajustado.
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values
  (gen_random_uuid(), 'admin@ev.pe',   '{"nombre":"Ana Admin"}'),
  (gen_random_uuid(), 'ventas@ev.pe',  '{"nombre":"Vero Ventas"}'),
  (gen_random_uuid(), 'ventas2@ev.pe', '{"nombre":"Otro Vendedor"}'),
  (gen_random_uuid(), 'taller@ev.pe',  '{"nombre":"Tito Técnico"}');
update public.profiles p set rol = x.rol::public.app_role
from (values ('admin@ev.pe','admin'), ('ventas@ev.pe','vendedor'), ('ventas2@ev.pe','vendedor'), ('taller@ev.pe','tecnico')) x(email, rol)
join auth.users u on u.email = x.email where p.id = u.id;

set role authenticated;
select test.como('admin@ev.pe');

-- ---------------------------------------------------------------- lote liquidado con 3 motos en tienda
-- Costo landing = 900 USD × 3.78 / 3 = S/ 1134.00; precio x1 (margen 45 %) = S/ 2061.82
insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('TEST-48', 'bicimoto', 48, 20, 500, 0.50, 300);
insert into public.import_batches (codigo_embarque, tipo_cambio) values ('LOTE-AJU', 3.78);
insert into test.ids select 'lote', id from public.import_batches where codigo_embarque = 'LOTE-AJU';
insert into test.ids select 'm48', id from public.vehicle_models where codigo_modelo = 'TEST-48';
insert into test.ids select 'showroom', id from public.locations where nombre = 'Showroom Piérola';

insert into public.batch_items (batch_id, model_id, cantidad_packing_list) values (test.id('lote'), test.id('m48'), 3);
insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor)
select test.id('lote'), test.id('m48'), 'AJU48VIN' || g, 'AJUMOT' || g from generate_series(1, 3) g;
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
  assert (select costo_landing_unitario_pen from public.batch_model_costs where batch_id = test.id('lote')) = 1134.00, 'costo 1134';
  assert (select precio_venta_pen from public.price_list where batch_id = test.id('lote') and tipo_venta = 'unidad_x1') = 2061.82, 'precio x1';
end $$;

-- ---------------------------------------------------------------- configuración: lectura staff, escritura admin
do $$ begin
  assert (select descuento_max_vendedor from public.configuracion_ventas) = 0.10, 'por defecto 10 %';
end $$;
select test.como('taller@ev.pe');
do $$ begin
  assert (select count(*) from public.configuracion_ventas) = 1, 'el técnico lee la configuración';
end $$;
select test.como('ventas@ev.pe');
update public.configuracion_ventas set descuento_max_vendedor = 0.5;
do $$ begin
  assert (select descuento_max_vendedor from public.configuracion_ventas) = 0.10, 'el vendedor no cambia el límite (RLS)';
end $$;
select test.expect_error($$insert into public.configuracion_ventas (id) values (true)$$, 'row-level security');
select test.como('admin@ev.pe');
update public.configuracion_ventas set descuento_max_vendedor = 0.15;
do $$ begin
  assert (select descuento_max_vendedor from public.configuracion_ventas) = 0.15, 'el admin cambia el límite';
end $$;
update public.configuracion_ventas set descuento_max_vendedor = 0.10;
select test.expect_error($$update public.configuracion_ventas set descuento_max_vendedor = 1$$, 'descuento_max_vendedor');
\echo '✔ 1. límite del vendedor: 10 % por defecto, lo leen todos y solo lo cambia el admin'

-- ---------------------------------------------------------------- orden del vendedor con 2 motos
select test.como('ventas@ev.pe');
insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento)
values ('Juan Pérez', 'DNI', '45678912');
insert into test.ids select 'o1', id from public.sales_orders where cliente_documento = '45678912';
insert into public.order_items (order_id, vehicle_id)
select test.id('o1'), id from public.vehicle_inventory where vin_chasis in ('AJU48VIN1', 'AJU48VIN2');
insert into test.ids select 'i1', oi.id from public.order_items oi join public.vehicle_inventory v on v.id = oi.vehicle_id where v.vin_chasis = 'AJU48VIN1';
insert into test.ids select 'i2', oi.id from public.order_items oi join public.vehicle_inventory v on v.id = oi.vehicle_id where v.vin_chasis = 'AJU48VIN2';

do $$ begin
  assert (select precio_lista_pen from public.order_items where id = test.id('i1')) = 2061.82, 'precio de lista fijado al agregar';
  assert (select total_pen from public.sales_orders where id = test.id('o1')) = 4123.64, 'total de lista';
end $$;
\echo '✔ 2. al agregar una moto se guarda su precio de lista'

-- ---------------------------------------------------------------- límites
select test.expect_error($$select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 2100)), 'Cliente frecuente')$$,
  'no puede superar el precio de lista');
select test.expect_error($$select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 2000)), '  ')$$,
  'Indica el motivo del descuento');
select test.expect_error($$select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 1999.999)), 'Cliente frecuente')$$,
  'hasta 2 decimales');
select test.expect_error($$select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 1750)), 'Cliente frecuente')$$,
  'Descuentos mayores al 10% requieren autorización del administrador');
-- 10 % exacto: 2061.82 × 0.90 = 1855.638 → 1855.64 está dentro del límite; 1855.63 no
select test.expect_error($$select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 1855.63)), 'Cliente frecuente')$$,
  'Descuentos mayores al 10%');
select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 1855.64)), 'Cliente frecuente');
do $$ begin
  assert (select precio_unitario_pen from public.order_items where id = test.id('i1')) = 1855.64, 'precio final';
  assert (select motivo_ajuste from public.order_items where id = test.id('i1')) = 'Cliente frecuente', 'motivo guardado';
  assert (select ajustado_por from public.order_items where id = test.id('i1')) = auth.uid(), 'quién ajustó';
  assert (select total_pen from public.sales_orders where id = test.id('o1')) = 3917.46, 'total recalculado';
end $$;
\echo '✔ 3. ≤ precio de lista, motivo obligatorio y vendedor hasta el 10 %'

-- ---------------------------------------------------------------- todo o nada y volver a lista
select test.expect_error($$select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(
    jsonb_build_object('item_id', test.id('i1'), 'precio', 1900),
    jsonb_build_object('item_id', test.id('i2'), 'precio', 1000)), 'Cliente frecuente')$$,
  'Descuentos mayores al 10%');
do $$ begin
  assert (select precio_unitario_pen from public.order_items where id = test.id('i1')) = 1855.64, 'la primera no cambió';
end $$;
select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 2061.82)), null);
do $$ begin
  assert (select motivo_ajuste is null and ajustado_por is null from public.order_items where id = test.id('i1')), 'sin ajuste';
  assert (select total_pen from public.sales_orders where id = test.id('o1')) = 4123.64, 'total de lista';
end $$;
\echo '✔ 4. todo o nada; volver al precio de lista borra el motivo'

-- ---------------------------------------------------------------- permisos
update public.order_items set precio_unitario_pen = 1 where id = test.id('i2');
do $$ begin
  assert (select precio_unitario_pen from public.order_items where id = test.id('i2')) = 2061.82, 'sin UPDATE directo (RLS)';
end $$;
select test.como('ventas2@ev.pe');
select test.expect_error($$select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 2000)), 'Cliente frecuente')$$,
  'pertenece a otro vendedor');
select test.como('taller@ev.pe');
select test.expect_error($$select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 2000)), 'Cliente frecuente')$$,
  'Solo un administrador o un vendedor');
-- Un ítem de otra orden no se ajusta por esta
select test.como('admin@ev.pe');
insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento)
values ('Rosa Díaz', 'DNI', '11223344');
insert into test.ids select 'o2', id from public.sales_orders where cliente_documento = '11223344';
select test.expect_error($$select public.ajustar_precio_item(test.id('o2'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 2000)), 'Cliente frecuente')$$,
  'no está en la orden');
\echo '✔ 5. sin UPDATE directo; ni otro vendedor ni el técnico ajustan precios'

-- ---------------------------------------------------------------- costo landing
-- Vendedor con un límite mayor que el margen: el mensaje no revela el costo
update public.configuracion_ventas set descuento_max_vendedor = 0.60;
select test.como('ventas@ev.pe');
do $$ begin
  perform public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 1000)), 'Cliente frecuente');
  raise exception 'SE ESPERABA ERROR';
exception when others then
  assert sqlerrm like '%por debajo del mínimo permitido%', 'mensaje genérico: ' || sqlerrm;
  assert position('1134' in sqlerrm) = 0, 'no revela el costo: ' || sqlerrm;
end $$;
select test.como('admin@ev.pe');
update public.configuracion_ventas set descuento_max_vendedor = 0.10;
select test.expect_error($$select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 1133.99)), 'Liquidación')$$,
  'por debajo del costo landing (S/ 1134.00)');
-- El admin no tiene límite de %: 45 % de descuento, justo en el costo
select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 1134)), 'Liquidación de stock');
do $$ begin
  assert (select precio_unitario_pen from public.order_items where id = test.id('i1')) = 1134.00, 'admin hasta el costo';
end $$;
\echo '✔ 6. nunca bajo el costo landing: genérico para el vendedor; el admin sin límite de %'

-- ---------------------------------------------------------------- re-cotización descarta ajustes
update public.price_margins set activo = true where tipo_venta = 'mayorista_x3';
select test.como('ventas@ev.pe');
update public.sales_orders set tipo_venta = 'mayorista_x3' where id = test.id('o1');
do $$ begin
  assert (select bool_and(precio_unitario_pen = precio_lista_pen and motivo_ajuste is null)
          from public.order_items where order_id = test.id('o1')), 'ajustes descartados';
  assert (select precio_lista_pen from public.order_items where id = test.id('i1'))
       = (select precio_venta_pen from public.price_list where batch_id = test.id('lote') and tipo_venta = 'mayorista_x3'), 'lista x3';
end $$;
update public.sales_orders set tipo_venta = 'unidad_x1' where id = test.id('o1');
\echo '✔ 7. al cambiar el tipo de venta se re-cotiza y se descartan los descuentos (RN-13)'

-- ---------------------------------------------------------------- confirmar con el total ajustado
select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(
  jsonb_build_object('item_id', test.id('i1'), 'precio', 1900),
  jsonb_build_object('item_id', test.id('i2'), 'precio', 1900)), 'Pago al contado');
insert into public.payments (order_id, metodo, monto_pen) values (test.id('o1'), 'efectivo', 3800);
update public.sales_orders set estado = 'confirmada' where id = test.id('o1');
do $$ begin
  assert (select estado from public.sales_orders where id = test.id('o1')) = 'confirmada', 'confirmada con 3800';
end $$;
select test.expect_error($$select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 1855.64)), 'Tarde')$$,
  'ya no es editable');
select test.como('admin@ev.pe');
do $$ begin
  assert (select sum(precio_unitario_pen) from public.v_sales_margin where order_id = test.id('o1')) = 3800, 'margen con el precio final';
  assert (select min(utilidad_pen) from public.v_sales_margin where order_id = test.id('o1')) = 766.00, 'utilidad 1900 − 1134';
end $$;
\echo '✔ 8. la venta se confirma con el total ajustado y v_sales_margin usa el precio final'

\o
\echo 'test_ajustar_precio: TODO OK'
