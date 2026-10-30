-- =============================================================================
-- Rol vendedor_tecnico (D42, migraciones rol_vendedor_tecnico_enum y rol_vendedor_tecnico)
-- Hace todo lo del técnico (registro, baterías, inspección, Listo rápido, color, mover,
-- reclamos) y todo lo del vendedor (precios, sus ventas, pagos, descuento hasta el 10 %),
-- y NO lee costos, lotes, proveedores ni gastos. El técnico y el vendedor siguen igual.
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values
  (gen_random_uuid(), 'admin@ev.pe',  '{"nombre":"Ana Admin"}'),
  (gen_random_uuid(), 'mixto@ev.pe',  '{"nombre":"Vicente Vendedor-Técnico"}'),
  (gen_random_uuid(), 'ventas@ev.pe', '{"nombre":"Vero Ventas"}'),
  (gen_random_uuid(), 'taller@ev.pe', '{"nombre":"Tito Técnico"}');
update public.profiles p set rol = x.rol::public.app_role
from (values ('admin@ev.pe','admin'), ('mixto@ev.pe','vendedor_tecnico'),
             ('ventas@ev.pe','vendedor'), ('taller@ev.pe','tecnico')) x(email, rol)
join auth.users u on u.email = x.email where p.id = u.id;

set role authenticated;
select test.como('admin@ev.pe');

-- ---------------------------------------------------------------- lote con 4 motos en el packing list
insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('TEST-48', 'bicimoto', 48, 20, 500, 0.50, 300);
insert into public.import_batches (codigo_embarque, tipo_cambio) values ('LOTE-VT', 3.78);
insert into public.proveedores (nombre) values ('Proveedor de prueba');
insert into public.gastos (estado, fecha_estimada, categoria, descripcion, monto_pen)
select 'planificado', public.fecha_lima(), (enum_range(null::public.categoria_gasto))[1], 'Gasto de prueba', 100;
insert into test.ids select 'lote', id from public.import_batches where codigo_embarque = 'LOTE-VT';
insert into test.ids select 'm48', id from public.vehicle_models where codigo_modelo = 'TEST-48';
insert into test.ids select 'showroom', id from public.locations where nombre = 'Showroom Piérola';
insert into test.ids select 'otra', id from public.locations where activo and nombre <> 'Showroom Piérola' order by nombre limit 1;
insert into public.batch_items (batch_id, model_id, cantidad_packing_list) values (test.id('lote'), test.id('m48'), 4);

do $$ begin
  assert public.has_role('admin') and public.puede_vender() and public.puede_taller(), 'el admin pasa las dos';
end $$;

-- El vendedor sigue sin registrar unidades (se prueba antes de llenar el packing list,
-- porque con el packing list completo responde antes el trigger de RN-04)
select test.como('ventas@ev.pe');
select test.expect_error($$insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor)
  values (test.id('lote'), test.id('m48'), 'VTVIN9', 'VTMOT9')$$, 'row-level security');

-- ---------------------------------------------------------------- lo del técnico
select test.como('mixto@ev.pe');
do $$ begin
  assert public.puede_vender() and public.puede_taller(), 'vendedor_tecnico pasa las dos';
  assert (select count(*) from public.pendientes_de_registro()) = 1, 've lo que falta registrar';
end $$;

insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor)
select test.id('lote'), test.id('m48'), 'VTVIN' || g, 'VTMOT' || g from generate_series(1, 4) g;
insert into test.ids select 'v' || right(vin_chasis, 1), id from public.vehicle_inventory where vin_chasis like 'VTVIN%';
do $$ begin
  assert (select count(*) from public.vehicle_inventory where vin_chasis like 'VTVIN%') = 4, 'registra unidades';
end $$;

-- Flujo normal del taller con la moto 1
update public.vehicle_inventory set estado = 'en_ensamble' where id = test.id('v1');
insert into public.vehicle_batteries (vehicle_id, serial, posicion)
select test.id('v1'), 'BAT-VT1-' || p, p from generate_series(1, 4) p;
insert into public.technical_inspections (vehicle_id, baterias_esperadas, baterias_contadas, voltaje_medido,
                                          vin_verificado, motor_verificado, checklist)
values (test.id('v1'), 0, 4, 51.2, true, true, '{"frenos":true,"luces":true,"claxon":true}');
update public.vehicle_inventory set estado = 'listo_en_tienda', location_id = test.id('showroom') where id = test.id('v1');
do $$ begin
  assert (select estado from public.vehicle_inventory where id = test.id('v1')) = 'listo_en_tienda', 'baterías, inspección y tienda';
end $$;

-- Listo rápido con las motos 2 y 3
select public.listo_rapido(jsonb_build_array(jsonb_build_object('vehicle_id', test.id('v2')),
                                             jsonb_build_object('vehicle_id', test.id('v3'))), test.id('showroom'));
do $$ begin
  assert (select count(*) from public.vehicle_inventory where id in (test.id('v2'), test.id('v3')) and estado = 'listo_en_tienda') = 2, 'Listo rápido';
end $$;

-- Editar color y mover ubicación
select public.editar_color_unidad(test.id('v4'), 'rojo', 'negro');
select public.mover_unidades(array[test.id('v3')], test.id('otra'));
do $$ begin
  assert (select color_primario from public.vehicle_inventory where id = test.id('v4')) = 'ROJO', 'edita el color';
  assert (select location_id from public.vehicle_inventory where id = test.id('v3')) = test.id('otra'), 'mueve la moto';
  assert (select count(*) from public.movimientos_ubicacion where vehicle_id = test.id('v3')) = 2, 'lee el historial de ubicaciones';
end $$;
\echo '✔ 1. vendedor_tecnico: registro, baterías, inspección, Listo rápido, color, mover e historial'

-- ---------------------------------------------------------------- costeo y liquidación (admin)
select test.como('admin@ev.pe');
-- Costo landing = 1200 USD × 3.78 / 4 = S/ 1134.00; precio x1 (margen 45 %) = S/ 2061.82
insert into public.batch_model_costs (batch_id, model_id, cantidad, tipo_cambio,
  fob_asignado_usd, flete_internacional_asignado_usd, gastos_agente_asignado_usd,
  impuestos_asignados_pen, flete_nacional_asignado_pen, alquiler_asignado_pen,
  sueldos_asignado_pen, publicidad_asignada_pen, armado_pen)
values (test.id('lote'), test.id('m48'), 4, 3.78, 1200, 0, 0, 0, 0, 0, 0, 0, 0);
update public.import_batches set estado = 'liquidado' where id = test.id('lote');

-- Orden de otro vendedor, para comprobar que no la toca
select test.como('ventas@ev.pe');
insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento)
values ('Rosa Díaz', 'DNI', '11223344');
insert into test.ids select 'o_ajena', id from public.sales_orders where cliente_documento = '11223344';

-- ---------------------------------------------------------------- lo del vendedor
select test.como('mixto@ev.pe');
do $$ begin
  assert (select precio_venta_pen from public.price_list where batch_id = test.id('lote') and tipo_venta = 'unidad_x1') = 2061.82, 'lee precios';
end $$;

insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento)
values ('Juan Pérez', 'DNI', '45678912');
insert into test.ids select 'o1', id from public.sales_orders where cliente_documento = '45678912';
do $$ begin
  assert (select vendedor_id from public.sales_orders where id = test.id('o1')) = auth.uid(), 'la orden es suya';
end $$;
insert into public.order_items (order_id, vehicle_id) values (test.id('o1'), test.id('v1')), (test.id('o1'), test.id('v2'));
insert into test.ids select 'i1', id from public.order_items where vehicle_id = test.id('v1');

-- Descuento: el límite del vendedor (10 %) también rige para él
select test.expect_error($$select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 1855.63)), 'Cliente frecuente')$$,
  'Descuentos mayores al 10%');
select public.ajustar_precio_item(test.id('o1'), jsonb_build_array(jsonb_build_object('item_id', test.id('i1'), 'precio', 1855.64)), 'Cliente frecuente');
do $$ begin
  assert (select total_pen from public.sales_orders where id = test.id('o1')) = 3917.46, 'total con descuento';
end $$;

insert into public.payments (order_id, metodo, monto_pen) values (test.id('o1'), 'efectivo', 3917.46);
update public.sales_orders set estado = 'confirmada' where id = test.id('o1');
do $$ begin
  assert (select estado from public.sales_orders where id = test.id('o1')) = 'confirmada', 'confirma su venta';
  assert (select count(*) from public.warranties where order_id = test.id('o1')) = 4, 'garantías creadas (general y baterías)';
end $$;
\echo '✔ 2. vendedor_tecnico: precios, orden, ítems, descuento hasta el 10 %, pago y confirmación'

-- Órdenes de otro vendedor: ni editar, ni borrar, ni agregar ítems o pagos
update public.sales_orders set cliente_telefono = '999' where id = test.id('o_ajena');
delete from public.sales_orders where id = test.id('o_ajena');
do $$ begin
  assert (select cliente_telefono is null from public.sales_orders where id = test.id('o_ajena')), 'no edita la orden ajena (RLS)';
end $$;
select test.expect_error($$insert into public.order_items (order_id, vehicle_id) values (test.id('o_ajena'), test.id('v3'))$$, 'row-level security');
select test.expect_error($$insert into public.payments (order_id, metodo, monto_pen) values (test.id('o_ajena'), 'efectivo', 10)$$, 'row-level security');
\echo '✔ 3. vendedor_tecnico: no toca las órdenes de otro vendedor'

-- ---------------------------------------------------------------- reclamos (como el técnico)
insert into public.warranty_claims (warranty_id, descripcion)
select id, 'No enciende' from public.warranties where order_id = test.id('o1') limit 1;
update public.warranty_claims set estado = 'en_revision';
do $$ begin
  assert (select estado from public.warranty_claims) = 'en_revision', 'atiende el reclamo';
end $$;
\echo '✔ 4. vendedor_tecnico: registra y atiende reclamos'

-- ---------------------------------------------------------------- sin costos
do $$ begin
  assert (select count(*) from public.import_batches) = 0, 'sin lotes';
  assert (select count(*) from public.batch_items) = 0, 'sin packing list';
  assert (select count(*) from public.batch_model_costs) = 0, 'sin costeos';
  assert (select count(*) from public.v_vehicle_costs) = 0, 'sin costo landing';
  assert (select count(*) from public.v_price_matrix) = 0, 'sin matriz de precios con costos';
  assert (select count(*) from public.v_sales_margin) = 0, 'sin márgenes';
  assert (select count(*) from public.proveedores) = 0, 'sin proveedores';
  assert (select count(*) from public.gastos) = 0, 'sin gastos';
end $$;
select test.expect_error($$insert into public.proveedores (nombre) values ('Otro')$$, 'row-level security');
select test.expect_error($$insert into public.gastos (estado, fecha_estimada, categoria, descripcion, monto_pen)
  select 'planificado', public.fecha_lima(), (enum_range(null::public.categoria_gasto))[1], 'x', 1$$, 'row-level security');
update public.price_list set precio_manual_pen = 1 where batch_id = test.id('lote');
select test.como('admin@ev.pe');
do $$ begin
  assert (select count(*) from public.price_list where precio_manual_pen is not null) = 0, 'no cambia precios (RLS)';
  assert (select count(*) from public.proveedores where nombre = 'Proveedor de prueba') = 1, 'el admin sí ve los proveedores';
  assert (select count(*) from public.gastos) = 1, 'el admin sí ve los gastos';
end $$;
\echo '✔ 5. vendedor_tecnico: no lee lotes, costeos, costos, márgenes, proveedores ni gastos'

-- ---------------------------------------------------------------- los roles actuales siguen igual
select test.como('taller@ev.pe');
do $$ begin
  assert not public.puede_vender() and public.puede_taller(), 'técnico: solo taller';
  assert (select count(*) from public.price_list) = 0, 'el técnico no lee precios';
end $$;
select test.expect_error($$insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento)
  values ('Luis', 'DNI', '87654321')$$, 'row-level security');
select test.expect_error($$select public.ajustar_precio_item(test.id('o_ajena'), '[{"item_id":"00000000-0000-0000-0000-000000000000","precio":1}]', 'Prueba')$$,
  'Solo un administrador o un vendedor');
select public.mover_unidades(array[test.id('v3')], test.id('showroom'));

select test.como('ventas@ev.pe');
do $$ begin
  assert public.puede_vender() and not public.puede_taller(), 'vendedor: solo ventas';
  assert (select count(*) from public.pendientes_de_registro()) = 0, 'el vendedor no ve lo que falta registrar';
  assert (select count(*) from public.movimientos_ubicacion) = 0, 'el vendedor no ve el historial de ubicaciones';
  assert (select count(*) from public.price_list) > 0, 'el vendedor lee precios';
end $$;
select test.expect_error($$select public.listo_rapido(jsonb_build_array(jsonb_build_object('vehicle_id', test.id('v4'))), test.id('showroom'))$$,
  'Solo un administrador o un técnico');
select test.expect_error($$select public.editar_color_unidad(test.id('v4'), 'azul')$$, 'Solo un administrador o un técnico');
select test.expect_error($$select public.mover_unidades(array[test.id('v4')], test.id('showroom'))$$, 'Solo un administrador o un técnico');
update public.warranty_claims set estado = 'aprobado', diagnostico = 'x';
do $$ begin
  assert (select estado from public.warranty_claims) = 'en_revision', 'el vendedor no atiende reclamos (RLS)';
end $$;
\echo '✔ 6. el técnico y el vendedor conservan exactamente sus permisos'

\o
\echo 'test_rol_vendedor_tecnico: TODO OK'
