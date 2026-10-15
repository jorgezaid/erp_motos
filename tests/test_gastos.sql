-- =============================================================================
-- Gastos del negocio y utilidad neta (M9, D32, migración gastos)
-- RN-21 validaciones · RN-22 los gastos no tocan lotes, costeos ni precios ·
-- RN-23 utilidad neta del mes · RN-24 solo admin (tabla, vista y Storage)
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values
  (gen_random_uuid(), 'admin@ev.pe',   '{"nombre":"Ana Admin"}'),
  (gen_random_uuid(), 'tecnico@ev.pe', '{"nombre":"Tito Técnico"}'),
  (gen_random_uuid(), 'ventas@ev.pe',  '{"nombre":"Vero Ventas"}');
update public.profiles p set rol = x.rol::public.app_role
from (values ('admin@ev.pe','admin'), ('tecnico@ev.pe','tecnico'), ('ventas@ev.pe','vendedor')) x(email, rol)
join auth.users u on u.email = x.email where p.id = u.id;
insert into test.ids select 'ventas', id from auth.users where email = 'ventas@ev.pe';

set role authenticated;
select test.como('admin@ev.pe');

-- ---------------------------------------------------------------- RN-21: alta y validaciones
insert into public.gastos (estado, fecha_estimada, categoria, descripcion, proveedor, monto_pen)
values ('planificado', public.fecha_lima() + 20, 'publicidad', 'Campaña de lanzamiento', 'Meta Ads', 1500);
insert into public.gastos (estado, fecha, categoria, descripcion, monto_pen, metodo_pago, creado_por)
values ('realizado', public.fecha_lima(), 'alquiler', 'Alquiler del local', 3000, 'transferencia',
        test.id('ventas'));
insert into test.ids select 'plan', id from public.gastos where categoria = 'publicidad';
insert into test.ids select 'alq', id from public.gastos where categoria = 'alquiler';

do $$ begin
  assert (select creado_por from public.gastos where id = test.id('alq')) = auth.uid(),
    'creado_por lo fija el sistema aunque el cliente envíe otro';
end $$;

select test.expect_error($$insert into public.gastos (estado, fecha, categoria, descripcion, monto_pen, metodo_pago)
  values ('realizado', public.fecha_lima(), 'otros', 'Cero', 0, 'efectivo')$$, 'monto_pen_check');
select test.expect_error($$insert into public.gastos (estado, categoria, descripcion, monto_pen)
  values ('planificado', 'otros', 'Sin fecha estimada', 10)$$, 'gasto_planificado_con_fecha_estimada');
select test.expect_error($$insert into public.gastos (estado, fecha_estimada, categoria, descripcion, monto_pen, metodo_pago)
  values ('realizado', public.fecha_lima(), 'otros', 'Sin fecha de pago', 10, 'efectivo')$$, 'gasto_realizado_con_fecha_y_metodo');
select test.expect_error($$insert into public.gastos (estado, fecha, categoria, descripcion, monto_pen)
  values ('realizado', public.fecha_lima(), 'otros', 'Sin método', 10)$$, 'gasto_realizado_con_fecha_y_metodo');
select test.expect_error($$insert into public.gastos (estado, fecha, categoria, descripcion, monto_pen, metodo_pago)
  values ('realizado', public.fecha_lima(), 'otros', 'Mixto', 10, 'mixto')$$, 'metodo_pago_check');
select test.expect_error($$insert into public.gastos (estado, fecha_estimada, categoria, descripcion, monto_pen)
  values ('planificado', public.fecha_lima(), 'otros', '   ', 10)$$, 'descripcion_check');

-- Marcar como realizado: monto real, fecha y método
update public.gastos set estado = 'realizado', fecha = public.fecha_lima(), monto_pen = 1450.50, metodo_pago = 'tarjeta'
where id = test.id('plan') and estado = 'planificado';
do $$ begin
  assert (select estado from public.gastos where id = test.id('plan')) = 'realizado', 'marcado como realizado';
  assert (select monto_pen from public.gastos where id = test.id('plan')) = 1450.50, 'con el monto real';
end $$;
-- Planificado otra vez: debe quitar la fecha de pago
select test.expect_error($$update public.gastos set estado = 'planificado' where id = test.id('plan')$$,
  'gasto_planificado_con_fecha_estimada');
\echo '✔ 1. RN-21: monto > 0, fechas según el estado, método sin "mixto"; marcar como realizado'

-- ---------------------------------------------------------------- RN-24: solo admin
insert into storage.objects (bucket_id, name) values ('comprobantes-gastos', test.id('alq') || '/recibo.pdf');
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'comprobantes-gastos') = 1, 'admin sube comprobantes';
end $$;
reset role;
do $$ begin
  assert (select not public from storage.buckets where id = 'comprobantes-gastos'), 'bucket privado';
end $$;
set role authenticated;

select test.como('ventas@ev.pe');
do $$ begin
  assert (select count(*) from public.gastos) = 0, 'vendedor no ve gastos';
  assert (select count(*) from public.v_utilidad_mensual) = 0, 'vendedor no ve la utilidad';
  assert (select count(*) from storage.objects where bucket_id = 'comprobantes-gastos') = 0, 'vendedor no ve comprobantes';
end $$;
select test.expect_error($$insert into public.gastos (estado, fecha_estimada, categoria, descripcion, monto_pen)
  values ('planificado', public.fecha_lima(), 'otros', 'Del vendedor', 10)$$, 'row-level security');
select test.expect_error($$insert into storage.objects (bucket_id, name) values ('comprobantes-gastos', 'x/y.pdf')$$,
  'row-level security');
update public.gastos set monto_pen = 1 where id = test.id('alq');
delete from public.gastos where id = test.id('alq');

select test.como('tecnico@ev.pe');
do $$ begin
  assert (select count(*) from public.gastos) = 0, 'técnico no ve gastos';
  assert (select count(*) from public.v_utilidad_mensual) = 0, 'técnico no ve la utilidad';
  assert (select count(*) from storage.objects where bucket_id = 'comprobantes-gastos') = 0, 'técnico no ve comprobantes';
end $$;
select test.expect_error($$insert into public.gastos (estado, fecha_estimada, categoria, descripcion, monto_pen)
  values ('planificado', public.fecha_lima(), 'otros', 'Del técnico', 10)$$, 'row-level security');
update public.gastos set monto_pen = 1 where id = test.id('alq');
delete from public.gastos where id = test.id('alq');
delete from storage.objects where bucket_id = 'comprobantes-gastos';

reset role;
set role anon;
select test.expect_error('select * from public.gastos', 'permission denied');
select test.expect_error('select * from public.v_utilidad_mensual', 'permission denied');
reset role;
set role authenticated;

select test.como('admin@ev.pe');
do $$ begin
  assert (select monto_pen from public.gastos where id = test.id('alq')) = 3000, 'RLS: vendedor y técnico no editan (0 filas)';
  assert (select count(*) from public.gastos) = 2, 'RLS: vendedor y técnico no borran (0 filas)';
  assert (select count(*) from storage.objects where bucket_id = 'comprobantes-gastos') = 1, 'ni borran comprobantes';
end $$;
\echo '✔ 2. RN-24: vendedor, técnico y anon no ven, crean, editan ni borran gastos o comprobantes'

-- ---------------------------------------------------------------- lote liquidado con una venta x1 confirmada
insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('TEST-48', 'bicimoto', 48, 20, 500, 0.50, 300);
insert into public.import_batches (codigo_embarque, tipo_cambio, publicidad_inicial_pen, alquiler_periodo_pen,
                                   sueldos_periodo_pen, flete_nacional_pen)
values ('LOTE-GASTOS', 3.78, 300, 600, 900, 150);
insert into test.ids select 'lote', id from public.import_batches where codigo_embarque = 'LOTE-GASTOS';
insert into test.ids select 'm48', id from public.vehicle_models where codigo_modelo = 'TEST-48';
insert into test.ids select 'showroom', id from public.locations where nombre = 'Showroom Piérola';

insert into public.batch_items (batch_id, model_id, cantidad_packing_list) values (test.id('lote'), test.id('m48'), 3);
insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor)
select test.id('lote'), test.id('m48'), 'GAS48VIN' || g, 'GASMOT' || g from generate_series(1, 3) g;
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
values (test.id('lote'), test.id('m48'), 3, 3.78, 900, 0, 0, 0, 150, 600, 900, 300, 180);
update public.import_batches set estado = 'liquidado' where id = test.id('lote');

select test.como('ventas@ev.pe');
insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento)
values ('Juan Pérez', 'DNI', '45678912');
insert into test.ids select 'o1', id from public.sales_orders where cliente_documento = '45678912';
insert into public.order_items (order_id, vehicle_id)
select test.id('o1'), id from public.vehicle_inventory where vin_chasis = 'GAS48VIN1';
insert into public.payments (order_id, metodo, monto_pen)
select id, 'efectivo', total_pen from public.sales_orders where id = test.id('o1');
update public.sales_orders set estado = 'confirmada' where id = test.id('o1');

select test.como('admin@ev.pe');
do $$ begin
  assert (select estado from public.sales_orders where id = test.id('o1')) = 'confirmada', 'venta confirmada';
  assert (select count(*) from public.price_list where batch_id = test.id('lote')) = 3, 'lote con precios';
end $$;

-- ---------------------------------------------------------------- RN-22: los gastos no tocan lotes, costeos ni precios
create temp table foto as
select (select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) from public.import_batches t)    as lotes,
       (select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) from public.batch_model_costs t) as costeos,
       (select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) from public.price_list t)        as precios,
       (select count(*) from public.batch_model_costs) as filas_costeo;

-- Crear un gasto de cada categoría (incluidas las que se parecen a costos del lote)
insert into public.gastos (estado, fecha, categoria, descripcion, monto_pen, metodo_pago)
select 'realizado', public.fecha_lima(), c, 'Prueba RN-22 ' || c, 100, 'efectivo'
from unnest(enum_range(null::public.categoria_gasto)) c;
-- Editar: monto, categoría, estado y fechas
update public.gastos set monto_pen = monto_pen + 50, categoria = 'publicidad' where descripcion like 'Prueba RN-22 %';
update public.gastos set estado = 'planificado', fecha = null, fecha_estimada = public.fecha_lima() + 5,
                         metodo_pago = null
where descripcion = 'Prueba RN-22 sueldos';
-- Borrar
delete from public.gastos where descripcion like 'Prueba RN-22 %';

do $$ begin
  assert (select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) from public.import_batches t)
       = (select lotes from foto), 'RN-22: import_batches no cambió';
  assert (select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) from public.batch_model_costs t)
       = (select costeos from foto), 'RN-22: batch_model_costs no cambió (el costeo no se invalidó)';
  assert (select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) from public.price_list t)
       = (select precios from foto), 'RN-22: price_list no cambió';
  assert (select count(*) from public.batch_model_costs) = (select filas_costeo from foto), 'RN-22: costeo intacto';
end $$;

-- Y por estructura: sin vínculo con lotes y sin triggers de gastos que mencionen esas tablas
reset role;
do $$ begin
  assert not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'gastos' and column_name = 'batch_id'),
    'RN-22: gastos no tiene batch_id';
  assert not exists (select 1 from pg_constraint where conrelid = 'public.gastos'::regclass and contype = 'f'
                       and confrelid in ('public.import_batches'::regclass, 'public.batch_model_costs'::regclass,
                                         'public.price_list'::regclass)),
    'RN-22: gastos no referencia lotes, costeos ni precios';
  assert not exists (select 1 from pg_trigger tg join pg_proc p on p.oid = tg.tgfoid
                     where tg.tgrelid = 'public.gastos'::regclass and not tg.tgisinternal
                       and p.prosrc ~* '(import_batches|batch_model_costs|price_list)'),
    'RN-22: ningún trigger de gastos escribe en lotes, costeos ni precios';
end $$;
set role authenticated;
select test.como('admin@ev.pe');
\echo '✔ 3. RN-22: crear, editar y borrar gastos no cambia import_batches, batch_model_costs ni price_list'

-- ---------------------------------------------------------------- RN-23: utilidad neta del mes
-- Este mes ya hay 2 realizados: alquiler 3000 + publicidad 1450.50. Se agregan uno del mes
-- pasado (no cuenta este mes) y un planificado (nunca cuenta).
insert into public.gastos (estado, fecha, categoria, descripcion, monto_pen, metodo_pago)
values ('realizado', (date_trunc('month', public.fecha_lima()) - interval '1 day')::date, 'servicios',
        'Luz del mes pasado', 250, 'efectivo');
insert into public.gastos (estado, fecha_estimada, categoria, descripcion, monto_pen)
values ('planificado', public.fecha_lima(), 'sueldos', 'Planilla por pagar', 5000);

do $$
declare
  v_mes    date := date_trunc('month', public.fecha_lima())::date;
  v_ventas numeric;
  v_costo  numeric;
  u        record;
begin
  select sum(precio_unitario_pen), sum(costo_landing_unitario_pen) into v_ventas, v_costo
  from public.v_sales_margin where order_id = test.id('o1');
  select * into u from public.v_utilidad_mensual where mes = v_mes;

  assert u.unidades_vendidas = 1, 'una unidad vendida este mes';
  assert u.ventas_pen = v_ventas and v_ventas > 0, 'ventas del mes = precio de lo vendido';
  assert u.costo_landing_pen = v_costo and v_costo > 0, 'costo landing de lo vendido';
  assert u.utilidad_bruta_pen = v_ventas - v_costo, 'utilidad bruta';
  assert u.cantidad_gastos = 2 and u.gastos_pen = 4450.50, 'solo los gastos realizados de este mes';
  assert u.utilidad_neta_pen = v_ventas - v_costo - 4450.50, 'RN-23: ventas − costo landing − gastos';

  select * into u from public.v_utilidad_mensual where mes = (v_mes - interval '1 month')::date;
  assert u.gastos_pen = 250 and u.ventas_pen = 0 and u.utilidad_neta_pen = -250, 'mes pasado: solo gastos';
end $$;

-- Una venta anulada deja de contar
update public.sales_orders set estado = 'anulada', motivo_anulacion = 'Prueba' where id = test.id('o1');
do $$ begin
  assert (select ventas_pen from public.v_utilidad_mensual where mes = date_trunc('month', public.fecha_lima())::date) = 0,
    'una venta anulada no cuenta';
  assert (select utilidad_neta_pen from public.v_utilidad_mensual where mes = date_trunc('month', public.fecha_lima())::date) = -4450.50,
    'sin ventas, la utilidad neta es − los gastos';
end $$;
\echo '✔ 4. RN-23: utilidad neta = ventas confirmadas − costo landing − gastos realizados del mes'
\echo ''
\echo 'TODAS LAS PRUEBAS DE GASTOS PASARON'
