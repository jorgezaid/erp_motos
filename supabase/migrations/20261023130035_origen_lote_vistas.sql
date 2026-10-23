-- =============================================================================
-- Origen del lote en las vistas (D41, tarea 17.6)
--   · v_stock: columna tipo_lote ('importacion' o 'compra_local') para filtrar por origen en
--     inventario y ventas. La vista es security_invoker y el vendedor y el técnico no leen
--     import_batches (solo admin), así que el origen sale de public.origen_lote(): security
--     definer que devuelve SOLO el tipo de lote (nunca proveedor ni costos) y solo a un usuario
--     con rol. El proveedor no se agrega a v_stock.
--   · v_vehicle_costs y v_sales_margin (solo admin): tipo_lote, proveedor_id y proveedor.
--   · Solo se agregan columnas al final (create or replace view): las existentes no cambian.
--   · Protección: foto de todos los lotes, costeos y price_list antes y después.
-- =============================================================================

create temp table _foto_lotes as select id, to_jsonb(b) as fila from public.import_batches b;
create temp table _foto_costos as select batch_id, to_jsonb(c) as fila from public.batch_model_costs c;
create temp table _foto_precios as select batch_id, to_jsonb(p) as fila from public.price_list p;

-- ---------------------------------------------------------------- origen para todos los roles
create function public.origen_lote(p_batch_id uuid) returns public.tipo_lote
language sql stable security definer set search_path = '' as $$
  select b.tipo_lote from public.import_batches b where b.id = p_batch_id and public.is_staff()
$$;

revoke execute on function public.origen_lote(uuid) from public, anon;
grant execute on function public.origen_lote(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- v_stock (sin costos ni proveedor)
create or replace view public.v_stock with (security_invoker = true) as
select v.id as vehicle_id, v.vin_chasis, v.nro_motor, v.estado,
       v.color_primario, v.color_secundario,
       l.nombre as ubicacion,
       m.codigo_modelo, m.categoria, m.voltaje_sistema, m.cantidad_baterias_12v,
       m.amperaje_bateria_ah, m.potencia_motor_watts,
       (select count(*) from public.vehicle_batteries bt where bt.vehicle_id = v.id) as baterias_registradas,
       (select t.aprobada from public.technical_inspections t
         where t.vehicle_id = v.id order by t.created_at desc limit 1)           as ultima_inspeccion_aprobada,
       max(pl.precio_venta_pen) filter (where pl.tipo_venta = 'unidad_x1')       as precio_x1,
       max(pl.precio_venta_pen) filter (where pl.tipo_venta = 'mayorista_x3')    as precio_x3,
       max(pl.precio_venta_pen) filter (where pl.tipo_venta = 'distribuidor_x6') as precio_x6,
       v.batch_id, v.model_id, v.location_id,
       public.origen_lote(v.batch_id) as tipo_lote
from public.vehicle_inventory v
join public.vehicle_models m on m.id = v.model_id
left join public.locations l on l.id = v.location_id
left join public.price_list pl on pl.batch_id = v.batch_id and pl.model_id = v.model_id
group by v.id, l.nombre, m.id;

-- ---------------------------------------------------------------- vistas de costos (solo admin)
create or replace view public.v_vehicle_costs with (security_invoker = true) as
select v.id as vehicle_id, v.vin_chasis, v.nro_motor, v.estado,
       b.codigo_embarque, m.codigo_modelo,
       c.costo_landing_unitario_pen as costo_landing_calculado_pen,
       b.tipo_lote, b.proveedor_id, pr.nombre as proveedor
from public.vehicle_inventory v
join public.import_batches b   on b.id = v.batch_id
join public.vehicle_models m   on m.id = v.model_id
left join public.batch_model_costs c on c.batch_id = v.batch_id and c.model_id = v.model_id
left join public.proveedores pr on pr.id = b.proveedor_id;

create or replace view public.v_sales_margin with (security_invoker = true) as
select o.id as order_id, o.numero, o.confirmada_at, o.tipo_venta, o.cliente_nombre,
       v.vin_chasis, m.codigo_modelo,
       oi.precio_unitario_pen,
       c.costo_landing_unitario_pen,
       oi.precio_unitario_pen - c.costo_landing_unitario_pen as utilidad_pen,
       round((oi.precio_unitario_pen - c.costo_landing_unitario_pen) / nullif(oi.precio_unitario_pen, 0), 4) as margen_real,
       b.tipo_lote, b.proveedor_id, pr.nombre as proveedor
from public.sales_orders o
join public.order_items oi on oi.order_id = o.id and oi.activo
join public.vehicle_inventory v on v.id = oi.vehicle_id
join public.vehicle_models m on m.id = v.model_id
join public.batch_model_costs c on c.batch_id = v.batch_id and c.model_id = v.model_id
join public.import_batches b on b.id = v.batch_id
left join public.proveedores pr on pr.id = b.proveedor_id
where o.estado = 'confirmada';

-- ---------------------------------------------------------------- protección
do $$
begin
  if exists (select * from _foto_lotes except select id, to_jsonb(b) from public.import_batches b)
     or exists (select id, to_jsonb(b) from public.import_batches b except select * from _foto_lotes)
     or exists (select * from _foto_costos except select batch_id, to_jsonb(c) from public.batch_model_costs c)
     or exists (select batch_id, to_jsonb(c) from public.batch_model_costs c except select * from _foto_costos)
     or exists (select * from _foto_precios except select batch_id, to_jsonb(p) from public.price_list p)
     or exists (select batch_id, to_jsonb(p) from public.price_list p except select * from _foto_precios) then
    raise exception 'La migración origen_lote_vistas cambió lotes, costeos o precios existentes: se cancela';
  end if;
end $$;

drop table _foto_lotes, _foto_costos, _foto_precios;
