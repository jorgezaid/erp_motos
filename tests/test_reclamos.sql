-- =============================================================================
-- Pruebas de reclamos de garantía (SPEC M7, RN-19, D27)
-- Uso: ./tests/run.sh
-- =============================================================================
\set QUIET on
\pset pager off
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values
  (gen_random_uuid(), 'admin@ev.pe', '{"nombre":"Ana"}'),
  (gen_random_uuid(), 'tecnico@ev.pe', '{"nombre":"Tito"}'),
  (gen_random_uuid(), 'ventas@ev.pe', '{"nombre":"Vero"}');
update public.profiles p set rol = x.rol::public.app_role
from (values ('admin@ev.pe','admin'), ('tecnico@ev.pe','tecnico'), ('ventas@ev.pe','vendedor')) x(email, rol)
join auth.users u on u.email = x.email where p.id = u.id;
insert into test.ids select 'tecnico', id from auth.users where email = 'tecnico@ev.pe';

-- Garantías armadas directamente (como postgres) para probar solo los reclamos
insert into public.vehicle_models (codigo_modelo, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('TEST-48', 'bicimoto', 48, 20, 500, 0.50, 300);
insert into public.import_batches (codigo_embarque) values ('LOTE-R');
insert into public.batch_items (batch_id, model_id, cantidad_packing_list)
select b.id, m.id, 1 from public.import_batches b, public.vehicle_models m;
insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor)
select batch_id, model_id, 'VIN-R1', 'MOT-R1' from public.batch_items;
insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento)
values ('Cliente', 'DNI', '12345678');
insert into public.warranties (vehicle_id, order_id, cobertura, fecha_inicio, fecha_fin, anulada)
select v.id, o.id, x.cobertura::public.warranty_coverage, x.inicio, x.fin, x.anulada
from public.vehicle_inventory v, public.sales_orders o,
     (values ('general', public.fecha_lima() - 10, public.fecha_lima() + 355, false),
             ('baterias', public.fecha_lima() - 200, public.fecha_lima() - 20, false)) x(cobertura, inicio, fin, anulada);
insert into test.ids select 'vigente', id from public.warranties where cobertura = 'general';
insert into test.ids select 'vencida', id from public.warranties where cobertura = 'baterias';

set role authenticated;

-- ---------------------------------------------------------------- RN-19 y valores iniciales
select test.como('ventas@ev.pe');
insert into public.warranty_claims (warranty_id, descripcion, estado, diagnostico)
values (test.id('vigente'), 'No enciende el display', 'aprobado', 'intento de saltar estados');
do $$ begin
  assert (select estado from public.warranty_claims) = 'abierto', 'todo reclamo empieza abierto';
  assert (select diagnostico from public.warranty_claims) is null, 'sin diagnóstico al crear';
  assert (select registrado_por from public.warranty_claims) = auth.uid(), 'registrado_por = quien lo crea';
end $$;
select test.expect_error($$insert into public.warranty_claims (warranty_id, descripcion)
  values (test.id('vencida'), 'Batería no carga')$$, 'Garantía vencida');
-- El vendedor no atiende reclamos (RLS: 0 filas)
update public.warranty_claims set estado = 'en_revision';
do $$ begin assert (select estado from public.warranty_claims) = 'abierto', 'el vendedor no cambia el estado'; end $$;
\echo '✔ 1. RN-19: solo garantías vigentes; el reclamo empieza abierto; el vendedor no lo atiende'

-- ---------------------------------------------------------------- máquina de estados
select test.como('tecnico@ev.pe');
select test.expect_error($$update public.warranty_claims set estado = 'aprobado'$$, 'Transición de reclamo no permitida: abierto → aprobado');
update public.warranty_claims set estado = 'en_revision';
do $$ begin
  assert (select tecnico_id from public.warranty_claims) = test.id('tecnico'), 'se registra el técnico que lo revisa';
end $$;
select test.expect_error($$update public.warranty_claims set estado = 'aprobado'$$, 'Registra el diagnóstico');
update public.warranty_claims set estado = 'aprobado', diagnostico = 'Display dañado: se cambia', costo_reparacion_pen = 150;
select test.expect_error($$update public.warranty_claims set estado = 'en_revision'$$, 'no permitida: aprobado → en_revision');
select test.expect_error($$update public.warranty_claims set warranty_id = test.id('vencida')$$, 'No se puede cambiar la garantía');
update public.warranty_claims set estado = 'cerrado';
select test.expect_error($$update public.warranty_claims set diagnostico = 'otro'$$, 'cerrado');
\echo '✔ 2. D27: abierto → en revisión → aprobado (con diagnóstico) → cerrado; un cerrado no se edita'
\echo ''
\echo 'TODAS LAS PRUEBAS DE reclamos PASARON'
