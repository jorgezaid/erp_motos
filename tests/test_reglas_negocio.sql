-- =============================================================================
-- Pruebas de integración del esquema: flujo completo + permisos + casos de error
-- Uso: ./tests/run.sh   (cada bloque falla con ASSERT si una regla no se cumple)
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null
-- Helpers (schema test, expect_error, como, id): tests/01_helpers.sql

-- ---------------------------------------------------------------- usuarios
insert into auth.users (id, email, raw_user_meta_data) values
  (gen_random_uuid(), 'admin@ev.pe',   '{"nombre":"Ana Admin"}'),
  (gen_random_uuid(), 'tecnico@ev.pe', '{"nombre":"Tito Técnico"}'),
  (gen_random_uuid(), 'ventas@ev.pe',  '{"nombre":"Vero Ventas"}'),
  (gen_random_uuid(), 'ventas2@ev.pe', '{"nombre":"Vico Ventas"}'),
  (gen_random_uuid(), 'nuevo@ev.pe',   '{}');

do $$ begin
  assert (select count(*) from public.profiles) = 5, 'handle_new_user debe crear 5 perfiles';
  assert (select count(*) from public.profiles where rol is null) = 5, 'los perfiles nacen sin rol';
end $$;

update public.profiles p set rol = x.rol::public.app_role
from (values ('admin@ev.pe','admin'),('tecnico@ev.pe','tecnico'),
             ('ventas@ev.pe','vendedor'),('ventas2@ev.pe','vendedor')) x(email, rol)
join auth.users u on u.email = x.email where p.id = u.id;

\echo '✔ 1. Usuarios y roles'

-- ---------------------------------------------------------------- ADMIN: catálogo y lote
set role authenticated;
select test.como('ventas@ev.pe');
select test.expect_error($$update public.profiles set rol = 'admin' where id = auth.uid()$$, 'Solo un administrador');

select test.como('admin@ev.pe');

insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('TEST-48', 'bicimoto', 48, 20, 500, 0.50, 300),
       ('TEST-72', 'trimoto_carga', 72, 32, 1200, 2.00, 900);

do $$ begin
  assert (select cantidad_baterias_12v from public.vehicle_models where codigo_modelo = 'TEST-48') = 4, '48V = 4 baterías';
  assert (select cantidad_baterias_12v from public.vehicle_models where codigo_modelo = 'TEST-72') = 6, '72V = 6 baterías';
end $$;
select test.expect_error($$insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
  potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario) values ('X', 'bicimoto', 36, 20, 500, 0.5, 1)$$, 'check');

insert into public.import_batches (codigo_embarque, nro_dam, tipo_cambio, fob_total_usd, flete_internacional_usd,
  ad_valorem_pen, igv_pen, ipm_pen, percepcion_pen, flete_nacional_pen, alquiler_periodo_pen, sueldos_periodo_pen,
  publicidad_inicial_pen)
values ('117GZH2606089', '118-2026-10-361056-01-0-00', 3.78, 7200, 800, 500, 1000, 200, 300, 400, 1000, 2000, 200);

insert into test.ids select 'lote', id from public.import_batches where codigo_embarque = '117GZH2606089';
insert into test.ids select 'm48', id from public.vehicle_models where codigo_modelo = 'TEST-48';
insert into test.ids select 'm72', id from public.vehicle_models where codigo_modelo = 'TEST-72';
insert into test.ids select 'showroom', id from public.locations where nombre = 'Showroom Piérola';

-- Snapshot de EXW/CBM desde el catálogo
insert into public.batch_items (batch_id, model_id, cantidad_packing_list, cantidad_dam)
values (test.id('lote'), test.id('m48'), 6, 6), (test.id('lote'), test.id('m72'), 2, 3);

do $$ begin
  assert (select impuestos_sunat_pen from public.import_batches where id = test.id('lote')) = 2000, 'suma impuestos';
  assert (select gastos_operativos_fijos_pen from public.import_batches where id = test.id('lote')) = 3000, 'alquiler+sueldos';
  assert (select exw_total_usd from public.batch_items where model_id = test.id('m48')) = 1800, 'snapshot EXW';
  assert (select cbm_total from public.batch_items where model_id = test.id('m72')) = 4.0, 'snapshot CBM';
end $$;
\echo '✔ 2. Catálogo, lote y packing list (admin)'

-- ---------------------------------------------------------------- aislamiento de costos
select test.como('ventas@ev.pe');
do $$ begin
  assert (select count(*) from public.import_batches) = 0,    'vendedor NO ve lotes';
  assert (select count(*) from public.batch_items) = 0,       'vendedor NO ve packing list';
  assert (select count(*) from public.vehicle_models) = 2,    'vendedor sí ve modelos';
  assert (select count(*) from public.pendientes_de_registro()) = 0, 'vendedor no ve pendientes';
end $$;
select test.expect_error($$insert into public.import_batches (codigo_embarque) values ('HACK')$$, 'row-level security');

select test.como('nuevo@ev.pe');
do $$ begin
  assert (select count(*) from public.vehicle_models) = 0, 'usuario sin rol no ve nada';
end $$;
\echo '✔ 3. Costos invisibles para vendedor; usuario sin rol bloqueado'

-- ---------------------------------------------------------------- TÉCNICO: seriales, baterías, inspección
select test.como('tecnico@ev.pe');
do $$ begin
  assert (select count(*) from public.pendientes_de_registro()) = 2, 'técnico ve qué falta registrar';
  assert (select count(*) from public.import_batches) = 0, 'técnico NO ve costos del lote';
end $$;

insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor, color_primario)
select test.id('lote'), test.id('m48'), ' lzs48vin00' || g, 'mot48-' || g, 'Rojo' from generate_series(1, 6) g;

do $$ begin
  assert (select count(*) from public.vehicle_inventory where vin_chasis like 'LZS48VIN00%') = 6, 'VIN normalizado a mayúsculas';
end $$;
select test.expect_error($$insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor)
  values (test.id('lote'), test.id('m48'), 'EXTRA', 'EXTRA')$$, 'ya están registradas todas');
select test.expect_error($$insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor)
  values (test.id('lote'), test.id('m72'), 'lzs48vin001', 'X1')$$, 'duplicate key');

insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor)
values (test.id('lote'), test.id('m72'), 'TRI72VIN001', 'MOT72-1');

insert into test.ids select 'v' || right(vin_chasis, 1), id from public.vehicle_inventory where vin_chasis like 'LZS48VIN00%';
insert into test.ids select 'tri', id from public.vehicle_inventory where vin_chasis = 'TRI72VIN001';

-- Baterías: 4 para 48V; la 5ª se rechaza
insert into public.vehicle_batteries (vehicle_id, serial, posicion)
select v.id, 'BAT-' || v.vin_chasis || '-' || p, p
from public.vehicle_inventory v cross join generate_series(1, 4) p
where v.vin_chasis like 'LZS48VIN00%';
select test.expect_error($$insert into public.vehicle_batteries (vehicle_id, serial, posicion)
  values (test.id('v1'), 'BAT-EXTRA', 5)$$, 'usa 4 baterías');

-- Máquina de estados
select test.expect_error($$update public.vehicle_inventory set estado = 'listo_en_tienda' where id = test.id('v1')$$, 'Transición no permitida');
update public.vehicle_inventory set estado = 'en_ensamble' where vin_chasis like 'LZS48VIN00%';
select test.expect_error($$update public.vehicle_inventory set estado = 'listo_en_tienda' where id = test.id('v1')$$, 'inspección técnica aprobada');

-- Inspección con 3 baterías contadas (el usuario intenta falsear "esperadas") → observada
insert into public.technical_inspections (vehicle_id, baterias_esperadas, baterias_contadas, vin_verificado, motor_verificado)
values (test.id('v1'), 3, 3, true, true);
do $$ begin
  assert (select baterias_esperadas from public.technical_inspections where vehicle_id = test.id('v1')) = 4,
    'baterias_esperadas la fija el sistema';
  assert not (select aprobada from public.technical_inspections where vehicle_id = test.id('v1')), '3 de 4 = observada';
end $$;
select test.expect_error($$update public.vehicle_inventory set estado = 'listo_en_tienda' where id = test.id('v1')$$, 'observada');

-- Re-inspección correcta para las 6 motos
insert into public.technical_inspections (vehicle_id, baterias_esperadas, baterias_contadas, voltaje_medido, vin_verificado, motor_verificado, checklist)
select v.id, 0, 4, 51.2, true, true, '{"frenos":true,"luces":true}'
from public.vehicle_inventory v where v.vin_chasis like 'LZS48VIN00%';

select test.expect_error($$update public.vehicle_inventory set estado = 'listo_en_tienda' where id = test.id('v1')$$, 'asigne una ubicación');
update public.vehicle_inventory set estado = 'listo_en_tienda', location_id = test.id('showroom')
where vin_chasis like 'LZS48VIN00%';

-- La trimoto 72V sin baterías no puede pasar a tienda
update public.vehicle_inventory set estado = 'en_ensamble' where id = test.id('tri');
insert into public.technical_inspections (vehicle_id, baterias_esperadas, baterias_contadas, vin_verificado, motor_verificado)
values (test.id('tri'), 0, 6, true, true);
select test.expect_error($$update public.vehicle_inventory set estado = 'listo_en_tienda', location_id = test.id('showroom')
  where id = test.id('tri')$$, 'exige 6');

-- El técnico no puede reservar ni vender
select test.expect_error($$update public.vehicle_inventory set estado = 'reservado' where id = test.id('v1')$$, 'orden de venta');
\echo '✔ 4. Seriales, baterías por voltaje, inspección y máquina de estados'

-- ---------------------------------------------------------------- ADMIN: auditoría y liquidación
select test.como('admin@ev.pe');
do $$
declare r record;
begin
  select * into r from public.v_batch_reconciliation where codigo_modelo = 'TEST-72';
  assert r.alerta_packing_vs_dam, 'packing (2) ≠ DAM (3) debe alertar';
  assert r.alerta_faltan_registrar, 'faltan trimotos por registrar';
  assert r.alerta_baterias, 'trimoto sin baterías debe alertar';
  select * into r from public.v_batch_reconciliation where codigo_modelo = 'TEST-48';
  assert not r.alerta_faltan_registrar and not r.alerta_baterias and r.unidades_inspeccion_aprobada = 6, 'motos 48V OK';
end $$;

select test.expect_error($$update public.import_batches set estado = 'liquidado' where id = test.id('lote')$$, 'sin costeo vigente');

-- Simula el resultado del Paso 2 (prorrateo) — números redondos verificables a mano
insert into public.batch_model_costs (batch_id, model_id, cantidad, tipo_cambio,
  fob_asignado_usd, flete_internacional_asignado_usd, gastos_agente_asignado_usd,
  impuestos_asignados_pen, flete_nacional_asignado_pen, alquiler_asignado_pen,
  sueldos_asignado_pen, publicidad_asignada_pen, armado_pen)
values (test.id('lote'), test.id('m48'), 6, 3.78, 1800, 100, 20, 1500, 120, 300, 600, 60, 360),
       (test.id('lote'), test.id('m72'), 2, 3.78, 1800, 400, 0,  500, 280, 250, 500, 50, 120);

-- (1800+100+20)*3.78 = 7257.60 ; +1500+120+300+600+60+360 = 10197.60 ; /6 = 1699.60
do $$ begin
  assert (select costo_landing_unitario_pen from public.batch_model_costs where model_id = test.id('m48')) = 1699.60,
    'costo landing unitario 48V = 1699.60';
end $$;

update public.import_batches set estado = 'liquidado' where id = test.id('lote');

do $$ begin
  assert (select liquidado_at is not null from public.import_batches where id = test.id('lote')), 'fecha liquidación';
  assert (select count(*) from public.price_list where batch_id = test.id('lote')) = 6, 'matriz 2 modelos × 3 escalas';
  assert (select precio_x1 from public.v_price_matrix where model_id = test.id('m48')) = 3090.18, 'x1 = 1699.60/0.55';
  assert (select precio_x3 from public.v_price_matrix where model_id = test.id('m48')) = 2614.77, 'x3 = 1699.60/0.65';
  assert (select precio_x6 from public.v_price_matrix where model_id = test.id('m48')) = 2360.56, 'x6 = 1699.60/0.72';
end $$;

select test.expect_error($$update public.import_batches set fob_total_usd = 1 where id = test.id('lote')$$, 'congelados');
select test.expect_error($$update public.batch_model_costs set armado_pen = 0 where batch_id = test.id('lote')$$, 'liquidado');
update public.import_batches set notas = 'Llegó completo' where id = test.id('lote');

-- x3 y x6 nacen desactivadas (D31); esta suite prueba las tres escalas
update public.price_margins set activo = true where tipo_venta in ('mayorista_x3', 'distribuidor_x6');
\echo '✔ 5. Auditoría packing/DAM, liquidación y matriz de precios automática'

-- ---------------------------------------------------------------- precios según rol
select test.como('ventas@ev.pe');
do $$ begin
  assert (select count(*) from public.price_list) = 6, 'vendedor ve precios';
  assert (select count(*) from public.batch_model_costs) = 0, 'vendedor NO ve costos';
  assert (select precio_x1 from public.v_stock where vehicle_id = test.id('v1')) = 3090.18, 'stock con precio';
end $$;
select test.como('tecnico@ev.pe');
do $$ begin
  assert (select precio_x1 from public.v_stock where vehicle_id = test.id('v1')) is null, 'técnico no ve precios';
end $$;
\echo '✔ 6. Visibilidad de precios por rol'

-- ---------------------------------------------------------------- VENTA x1 con pago mixto
select test.como('ventas@ev.pe');
insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento, total_pen, estado)
values ('Juan Pérez', 'DNI', '45678912', 1, 'confirmada');   -- total y estado se ignoran
insert into test.ids select 'o1', id from public.sales_orders where cliente_documento = '45678912';

do $$ begin
  assert (select estado from public.sales_orders where id = test.id('o1')) = 'borrador', 'nace en borrador';
end $$;
select test.expect_error($$insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento)
  values ('X', 'DNI', '123')$$, 'documento_valido');

insert into public.order_items (order_id, vehicle_id, precio_unitario_pen) values (test.id('o1'), test.id('v1'), 1);
do $$ begin
  assert (select precio_unitario_pen from public.order_items where order_id = test.id('o1')) = 3090.18, 'precio lo pone el sistema';
  assert (select total_pen from public.sales_orders where id = test.id('o1')) = 3090.18, 'total recalculado';
  assert (select estado from public.vehicle_inventory where id = test.id('v1')) = 'reservado', 'unidad reservada';
end $$;

-- Otra orden no puede tomar la misma unidad
insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento)
values ('Otro', 'RUC', '20123456789');
insert into test.ids select 'o_ruc', id from public.sales_orders where cliente_documento = '20123456789';
select test.expect_error($$insert into public.order_items (order_id, vehicle_id) values (test.id('o_ruc'), test.id('v1'))$$, 'no está disponible');

-- Manipular total no sirve
update public.sales_orders set total_pen = 10 where id = test.id('o1');
do $$ begin
  assert (select total_pen from public.sales_orders where id = test.id('o1')) = 3090.18, 'total protegido';
end $$;

-- x3 con 1 unidad → no confirma
update public.sales_orders set tipo_venta = 'mayorista_x3' where id = test.id('o1');
do $$ begin
  assert (select total_pen from public.sales_orders where id = test.id('o1')) = 2614.77, 're-cotiza a x3';
end $$;
select test.expect_error($$update public.sales_orders set estado = 'confirmada' where id = test.id('o1')$$, 'mínimo 3 unidades');
update public.sales_orders set tipo_venta = 'unidad_x1' where id = test.id('o1');

-- Pagos incompletos → no confirma
insert into public.payments (order_id, metodo, monto_pen) values (test.id('o1'), 'efectivo', 1000);
select test.expect_error($$update public.sales_orders set estado = 'confirmada' where id = test.id('o1')$$, 'no cuadran');
insert into public.payments (order_id, metodo, monto_pen, referencia) values (test.id('o1'), 'tarjeta', 2090.18, 'VISA-8812');

-- Otro vendedor no puede tocar la orden
select test.como('ventas2@ev.pe');
update public.sales_orders set cliente_nombre = 'Hackeado' where id = test.id('o1');
do $$ begin
  assert (select cliente_nombre from public.sales_orders where id = test.id('o1')) = 'Juan Pérez', 'RLS: orden ajena intacta';
end $$;

select test.como('ventas@ev.pe');
update public.sales_orders set estado = 'confirmada' where id = test.id('o1');
do $$ begin
  assert (select metodo_pago from public.sales_orders where id = test.id('o1')) = 'mixto', 'efectivo+tarjeta = mixto';
  assert (select estado from public.vehicle_inventory where id = test.id('v1')) = 'vendido', 'unidad vendida';
  assert (select count(*) from public.v_warranties where order_id = test.id('o1') and vigente) = 2, 'garantía general + baterías';
end $$;

select test.expect_error($$update public.sales_orders set cliente_nombre = 'Cambio' where id = test.id('o1')$$, 'confirmada');
select test.expect_error($$delete from public.order_items where order_id = test.id('o1')$$, 'borrador');
select test.expect_error($$insert into public.payments (order_id, metodo, monto_pen) values (test.id('o1'), 'efectivo', 5)$$, 'no admite');
update public.sales_orders set cliente_telefono = '999888777' where id = test.id('o1');   -- contacto sí

-- Reclamo de garantía
insert into public.warranty_claims (warranty_id, descripcion)
select id, 'Batería no carga al 100%' from public.warranties where order_id = test.id('o1') and cobertura = 'baterias';

-- El vendedor no puede anular una venta confirmada
select test.expect_error($$update public.sales_orders set estado = 'anulada', motivo_anulacion = 'x' where id = test.id('o1')$$, 'administrador');
\echo '✔ 7. Venta x1: precio automático, reserva, pago mixto, confirmación y garantías'

-- ---------------------------------------------------------------- ADMIN anula → unidad vuelve a tienda
select test.como('admin@ev.pe');
select test.expect_error($$update public.import_batches set estado = 'en_almacen' where id = test.id('lote')$$, 'reservadas o vendidas');
select test.expect_error($$update public.sales_orders set estado = 'anulada' where id = test.id('o1')$$, 'anulacion_con_motivo');
update public.sales_orders set estado = 'anulada', motivo_anulacion = 'Cliente desistió' where id = test.id('o1');
do $$ begin
  assert (select estado from public.vehicle_inventory where id = test.id('v1')) = 'listo_en_tienda', 'unidad liberada';
  assert (select count(*) from public.warranties where order_id = test.id('o1') and anulada) = 2, 'garantías anuladas';
  assert (select total_pen from public.sales_orders where id = test.id('o1')) = 3090.18, 'total histórico conservado';
end $$;
select test.expect_error($$update public.sales_orders set cliente_nombre = 'x' where id = test.id('o1')$$, 'anulada');
\echo '✔ 8. Anulación por admin libera la unidad y anula garantías'

-- ---------------------------------------------------------------- VENTA x6 a distribuidor
select test.como('ventas@ev.pe');
delete from public.sales_orders where id = test.id('o_ruc');            -- borrador: se puede borrar
insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento, tipo_venta)
values ('Distribuidora Norte SAC', 'RUC', '20601234567', 'distribuidor_x6');
insert into test.ids select 'o6', id from public.sales_orders where cliente_documento = '20601234567';
insert into public.order_items (order_id, vehicle_id)
select test.id('o6'), id from public.vehicle_inventory where vin_chasis like 'LZS48VIN00%';
insert into public.payments (order_id, metodo, monto_pen) values (test.id('o6'), 'transferencia', 6 * 2360.56);
update public.sales_orders set estado = 'confirmada' where id = test.id('o6');
do $$ begin
  assert (select total_pen from public.sales_orders where id = test.id('o6')) = 14163.36, '6 × 2360.56';
  assert (select metodo_pago from public.sales_orders where id = test.id('o6')) = 'transferencia', 'un solo método';
  assert (select count(*) from public.vehicle_inventory where estado = 'vendido') = 6, '6 vendidas';
end $$;

select test.como('admin@ev.pe');
do $$ begin
  assert (select round(avg(margen_real), 2) from public.v_sales_margin where order_id = test.id('o6')) = 0.28, 'margen real x6 = 28%';
end $$;
delete from public.sales_orders where id = test.id('o6');       -- RLS lo filtra en silencio
do $$ begin
  assert (select count(*) from public.sales_orders where id = test.id('o6')) = 1, 'venta confirmada no se borra';
end $$;
\echo '✔ 9. Venta x6 con margen real verificado (28%)'

-- ---------------------------------------------------------------- márgenes y anon
update public.price_margins set margen_objetivo = 0.50 where tipo_venta = 'unidad_x1';
do $$ begin
  assert (select precio_x1 from public.v_price_matrix where model_id = test.id('m48')) = 3399.20, 'x1 recalculado a 50%';
end $$;

reset role;
set role anon;
select test.expect_error($$select count(*) from public.vehicle_inventory$$, 'permission denied');
reset role;

-- Historial
do $$ begin
  assert (select count(*) from public.vehicle_status_history where vehicle_id = test.id('v1')) >= 7, 'trazabilidad de estados';
end $$;
\echo '✔ 10. Cambio de márgenes recalcula precios; anon bloqueado; historial registrado'
\echo ''
\echo 'TODAS LAS PRUEBAS PASARON'
