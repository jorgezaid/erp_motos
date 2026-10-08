-- ⚠️⚠️⚠️ SOLO LOCAL — contiene contraseñas conocidas ⚠️⚠️⚠️
-- (actúa como los usuarios demo de 01_usuarios_demo.sql). NUNCA ejecutar en producción.
-- =============================================================================
-- Datos demo para desarrollo local, después de 01_usuarios_demo.sql. Los carga `pnpm db:demo`.
-- Todo pasa por las reglas de la BD (triggers, guardar_costeo, liquidación y venta) actuando
-- como los usuarios demo, así que los datos son coherentes con lo que haría la app.
--
--   Modelos  DEMO-48 (48V, 4 bat.), DEMO-60 (60V, 5 bat.), DEMO-72 (72V, 6 bat.)
--   Lote DEMO-LIQ-001  liquidado · DEMO-48 ×24 y DEMO-72 ×8 · costos del golden test (SPEC §7) ×4:
--                      mismas proporciones, así que el costo unitario es el del golden test
--                      30 unidades listas en Showroom Piérola, 1 en ensamble y 1 vendida (orden #1)
--   Lote DEMO-ALM-002  en almacén, sin liquidar · DEMO-60 ×5 · 3 unidades en caja, faltan 2 por registrar
-- =============================================================================

-- Como el admin demo (auth.uid() lee request.jwt.claim.sub)
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

insert into public.vehicle_models (codigo_modelo, nombre_comercial, categoria, voltaje_sistema, amperaje_bateria_ah,
                                   potencia_motor_watts, volumen_cbm_unitario, exw_usd_unitario)
values ('DEMO-48', 'Bicimoto urbana 48V', 'bicimoto', 48, 20, 500, 0.50, 300),
       ('DEMO-60', 'Bicimoto 60V', 'bicimoto', 60, 20, 800, 0.80, 500),
       ('DEMO-72', 'Trimoto de carga 72V', 'trimoto_carga', 72, 32, 1200, 2.00, 900);

insert into public.import_batches (codigo_embarque, nro_dam, proveedor, fecha_embarque, fecha_llegada, tipo_cambio,
  fob_total_usd, flete_internacional_usd, gastos_agente_usd, ad_valorem_pen, igv_pen, ipm_pen, percepcion_pen,
  flete_nacional_pen, alquiler_periodo_pen, sueldos_periodo_pen, publicidad_inicial_pen, estado)
values ('DEMO-LIQ-001', '118-2026-10-000001-01-0-00', 'Guangzhou EV Co.', '2026-08-01', '2026-09-10', 3.78,
        28800, 3200, 800, 2000, 4000, 800, 1200, 1600, 4000, 8000, 800, 'en_almacen'),
       ('DEMO-ALM-002', null, 'Guangzhou EV Co.', '2026-09-15', '2026-10-05', 3.75,
        2500, 300, 100, 200, 450, 90, 120, 150, 500, 900, 100, 'en_almacen');

insert into public.batch_items (batch_id, model_id, cantidad_packing_list, cantidad_dam, exw_usd_unitario, volumen_cbm_unitario)
select b.id, m.id, x.q, x.q, m.exw_usd_unitario, m.volumen_cbm_unitario
from (values ('DEMO-LIQ-001', 'DEMO-48', 24), ('DEMO-LIQ-001', 'DEMO-72', 8), ('DEMO-ALM-002', 'DEMO-60', 5)) x(lote, modelo, q)
join public.import_batches b on b.codigo_embarque = x.lote
join public.vehicle_models m on m.codigo_modelo = x.modelo;

-- Unidades (VIN DEMO48-001…), con baterías e inspección aprobada las que van a tienda
do $$
declare
  u record;
  v_id uuid;
  v_tienda uuid := (select id from public.locations where nombre = 'Showroom Piérola');
  v_taller uuid := (select id from public.locations where nombre = 'Taller de Ensamble');
  n int;
begin
  for u in
    select b.id as batch_id, m.id as model_id, m.codigo_modelo, m.cantidad_baterias_12v as baterias,
           g.i, x.listas, x.registrar
    from (values ('DEMO-LIQ-001', 'DEMO-48', 24, 24), ('DEMO-LIQ-001', 'DEMO-72', 7, 8),
                 ('DEMO-ALM-002', 'DEMO-60', 0, 3)) x(lote, modelo, listas, registrar)
    join public.import_batches b on b.codigo_embarque = x.lote
    join public.vehicle_models m on m.codigo_modelo = x.modelo
    cross join lateral generate_series(1, x.registrar) g(i)
    order by m.codigo_modelo, g.i
  loop
    insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor, color_primario, location_id)
    values (u.batch_id, u.model_id,
            replace(u.codigo_modelo, '-', '') || '-' || lpad(u.i::text, 3, '0'),
            'MOT-' || replace(u.codigo_modelo, '-', '') || '-' || lpad(u.i::text, 3, '0'),
            (array['Negro', 'Rojo', 'Azul', 'Blanco'])[1 + u.i % 4],
            case when u.i <= u.listas then v_taller end)
    returning id into v_id;

    if u.i <= u.listas then
      update public.vehicle_inventory set estado = 'en_ensamble' where id = v_id;
      for n in 1 .. u.baterias loop
        insert into public.vehicle_batteries (vehicle_id, serial, posicion)
        values (v_id, 'BAT-' || replace(u.codigo_modelo, '-', '') || '-' || lpad(u.i::text, 3, '0') || '-' || n, n);
      end loop;
      insert into public.technical_inspections (vehicle_id, baterias_contadas, voltaje_medido, vin_verificado,
                                                motor_verificado, checklist)
      values (v_id, u.baterias, u.baterias * 12 + 1.5, true, true,
              '{"frenos": true, "luces": true, "claxon": true}');
      update public.vehicle_inventory set estado = 'listo_en_tienda', location_id = v_tienda where id = v_id;
    elsif u.registrar > u.listas and u.codigo_modelo = 'DEMO-72' then
      -- Una unidad en ensamble, para probar el taller
      update public.vehicle_inventory set estado = 'en_ensamble', location_id = v_taller where id = v_id;
    end if;
  end loop;
end $$;

-- Costeo: reparto proporcional (SPEC §7) redondeado a 4 decimales; guardar_costeo lo revalida
-- (invariantes 1, 2 y 4 con tolerancia 0.01) y luego se liquida (RN-07 genera los precios, RN-09)
do $$
declare
  b public.import_batches;
  v_filas jsonb;
begin
  select * into b from public.import_batches where codigo_embarque = 'DEMO-LIQ-001';
  with t as (
    select sum(cantidad_packing_list) q, sum(exw_total_usd) exw, sum(cbm_total) cbm
    from public.batch_items where batch_id = b.id
  )
  select jsonb_agg(jsonb_build_object(
    'model_id', i.model_id, 'cantidad', i.cantidad_packing_list, 'tipo_cambio', b.tipo_cambio,
    'fob_asignado_usd', round(b.fob_total_usd * i.exw_total_usd / t.exw, 4),
    'impuestos_asignados_pen', round(b.impuestos_asignables_pen * i.exw_total_usd / t.exw, 4),
    'flete_internacional_asignado_usd', round(b.flete_internacional_usd * i.cbm_total / t.cbm, 4),
    'gastos_agente_asignado_usd', round(b.gastos_agente_usd * i.cbm_total / t.cbm, 4),
    'flete_nacional_asignado_pen', round(b.flete_nacional_pen * i.cbm_total / t.cbm, 4),
    'alquiler_asignado_pen', round(b.alquiler_periodo_pen * i.cantidad_packing_list / t.q, 4),
    'sueldos_asignado_pen', round(b.sueldos_periodo_pen * i.cantidad_packing_list / t.q, 4),
    'publicidad_asignada_pen', round(b.publicidad_inicial_pen * i.cantidad_packing_list / t.q, 4),
    'armado_pen', i.cantidad_packing_list * b.costo_armado_unitario_pen))
  into v_filas
  from public.batch_items i, t
  where i.batch_id = b.id;

  perform public.guardar_costeo(b.id, v_filas);
  update public.import_batches set estado = 'liquidado' where id = b.id;
end $$;

-- Una venta x1 confirmada por la vendedora demo (genera garantías para probar /garantias)
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a000-000000000003', false);
do $$
declare
  v_orden uuid;
  v_unidad uuid := (select id from public.vehicle_inventory where vin_chasis = 'DEMO72-001');
begin
  insert into public.sales_orders (cliente_nombre, cliente_tipo_documento, cliente_documento, cliente_telefono)
  values ('Juana Pérez Quispe', 'DNI', '45678912', '987654321')
  returning id into v_orden;
  insert into public.order_items (order_id, vehicle_id) values (v_orden, v_unidad);
  -- Pago mixto: S/ 5 000 en efectivo y el saldo por transferencia
  insert into public.payments (order_id, metodo, monto_pen, referencia)
  values (v_orden, 'efectivo', 5000, null);
  insert into public.payments (order_id, metodo, monto_pen, referencia)
  select v_orden, 'transferencia', total_pen - 5000, 'OP-000123' from public.sales_orders where id = v_orden;
  update public.sales_orders set estado = 'confirmada' where id = v_orden;
end $$;

select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);
