-- =============================================================================
-- Precio final por encima del precio de lista (D43, extiende D38/RN-25 y D42)
--   · configuracion_ventas.aumento_max_lista (30 % por defecto, lo cambia solo el admin):
--     tope del precio final sobre la lista, para atrapar errores de tipeo. Aplica a TODOS los
--     roles, también al admin.
--   · order_items: se quita el CHECK precio_no_supera_lista (el tope es configurable y un
--     CHECK no puede leerlo: lo aplica la RPC). descuento_con_motivo se mantiene: exige motivo
--     siempre que el precio final sea distinto del de lista (mayor o menor).
--   · ajustar_precio_item: acepta precio > lista con motivo (admin, vendedor y
--     vendedor_tecnico) hasta lista × (1 + aumento_max_lista); el motivo y la auditoría se
--     guardan cuando precio <> lista. Los descuentos no cambian (límite % del vendedor para
--     todo el que no es admin y nunca bajo el costo landing).
--   · Protección: foto de todos los lotes, costeos y price_list antes y después.
-- =============================================================================

create temp table _foto_lotes as select id, to_jsonb(b) as fila from public.import_batches b;
create temp table _foto_costos as select batch_id, to_jsonb(c) as fila from public.batch_model_costs c;
create temp table _foto_precios as select batch_id, to_jsonb(p) as fila from public.price_list p;

-- ---------------------------------------------------------------- configuración
alter table public.configuracion_ventas
  add column aumento_max_lista numeric(5,4) not null default 0.30
    check (aumento_max_lista > 0 and aumento_max_lista <= 1);

comment on column public.configuracion_ventas.aumento_max_lista is
  'D43: el precio final no puede superar la lista en más de esta fracción (todos los roles).';

-- ---------------------------------------------------------------- order_items
alter table public.order_items drop constraint precio_no_supera_lista;

-- ---------------------------------------------------------------- ajustar_precio_item (D38, D42, D43)
create or replace function public.ajustar_precio_item(p_order_id uuid, p_ajustes jsonb, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o         public.sales_orders;
  a         jsonb;
  it        public.order_items;
  v_vin     text;
  v_precio  numeric;
  v_costo   numeric;
  v_max     numeric;
  v_aumento numeric;
  v_admin   boolean := public.has_role('admin');
  v_motivo  text := nullif(trim(p_motivo), '');
  v_total   numeric;
begin
  if not (v_admin or public.puede_vender()) then
    raise exception 'Solo un administrador o un vendedor puede ajustar precios' using errcode = '42501';
  end if;
  if jsonb_typeof(p_ajustes) is distinct from 'array' or jsonb_array_length(p_ajustes) = 0 then
    raise exception 'Indica al menos un precio';
  end if;
  if jsonb_array_length(p_ajustes) > 100 then
    raise exception 'Se ajustan hasta 100 unidades a la vez';
  end if;

  select * into o from public.sales_orders where id = p_order_id for update;
  if not found or not public.can_edit_order(p_order_id) then
    raise exception 'La orden no existe o pertenece a otro vendedor' using errcode = '42501';
  end if;
  if o.estado <> 'borrador' then
    raise exception 'La orden #% ya no es editable (estado: %)', o.numero, o.estado;
  end if;

  select descuento_max_vendedor, aumento_max_lista into v_max, v_aumento from public.configuracion_ventas where id;
  v_max := coalesce(v_max, 0);
  v_aumento := coalesce(v_aumento, 0);

  for a in select * from jsonb_array_elements(p_ajustes) loop
    begin
      v_precio := (a ->> 'precio')::numeric;
      select * into it from public.order_items
      where id = (a ->> 'item_id')::uuid and order_id = p_order_id and activo
      for update;
    exception when invalid_text_representation then
      raise exception 'Un dato no tiene el formato esperado';
    end;
    if it.id is null then
      raise exception 'Una de las unidades no está en la orden #%', o.numero;
    end if;
    select v.vin_chasis into v_vin from public.vehicle_inventory v where v.id = it.vehicle_id;

    if v_precio is null or v_precio <= 0 or v_precio <> round(v_precio, 2) then
      raise exception 'Unidad %: el precio debe ser mayor que 0 y tener hasta 2 decimales', v_vin;
    end if;
    -- Tope sobre la lista (todos los roles, también el admin): evita errores de tipeo
    if v_precio > it.precio_lista_pen * (1 + v_aumento) then
      raise exception '%', format('El precio supera en más de %s %% el precio de lista. Revisa el monto.',
                                  trim_scale(v_aumento * 100));
    end if;
    if v_precio > it.precio_lista_pen and (v_motivo is null or length(v_motivo) < 5) then
      raise exception 'Indica el motivo del precio sobre la lista (mínimo 5 caracteres)';
    end if;
    if v_precio < it.precio_lista_pen and (v_motivo is null or length(v_motivo) < 5) then
      raise exception 'Indica el motivo del descuento (mínimo 5 caracteres)';
    end if;
    -- Límite del vendedor (también del vendedor_tecnico): no revela el costo
    if not v_admin and it.precio_lista_pen - v_precio > it.precio_lista_pen * v_max then
      raise exception '%', format('Descuentos mayores al %s%% requieren autorización del administrador',
                                  trim_scale(v_max * 100));
    end if;

    select c.costo_landing_unitario_pen into v_costo
    from public.vehicle_inventory v
    join public.batch_model_costs c on c.batch_id = v.batch_id and c.model_id = v.model_id
    where v.id = it.vehicle_id;
    if v_costo is null then
      raise exception 'Unidad %: no tiene costo landing; no se puede ajustar su precio', v_vin;
    end if;
    if v_precio < v_costo then
      if v_admin then
        raise exception 'Unidad %: S/ % está por debajo del costo landing (S/ %)', v_vin, v_precio, v_costo;
      end if;
      raise exception 'Unidad %: el precio está por debajo del mínimo permitido', v_vin;
    end if;

    update public.order_items
    set precio_unitario_pen = v_precio,
        motivo_ajuste = case when v_precio <> it.precio_lista_pen then v_motivo end,
        ajustado_por  = case when v_precio <> it.precio_lista_pen then auth.uid() end,
        ajustado_at   = case when v_precio <> it.precio_lista_pen then now() end
    where id = it.id;
  end loop;

  -- sales_order_before_update recalcula total_pen desde los ítems
  update public.sales_orders set updated_at = now() where id = p_order_id
  returning total_pen into v_total;
  return jsonb_build_object('total', v_total);
end $$;

comment on function public.ajustar_precio_item(uuid, jsonb, text) is
  'D38/D43: ajusta el precio final de ítems de una orden en borrador (≥ costo landing, ≤ lista × (1 + aumento_max_lista), motivo si difiere de la lista, límite % de descuento para quien no es admin).';

revoke execute on function public.ajustar_precio_item(uuid, jsonb, text) from public, anon;
grant execute on function public.ajustar_precio_item(uuid, jsonb, text) to authenticated, service_role;

-- ---------------------------------------------------------------- protección
do $$
begin
  if exists (select * from _foto_lotes except select id, to_jsonb(b) from public.import_batches b)
     or exists (select id, to_jsonb(b) from public.import_batches b except select * from _foto_lotes)
     or exists (select * from _foto_costos except select batch_id, to_jsonb(c) from public.batch_model_costs c)
     or exists (select batch_id, to_jsonb(c) from public.batch_model_costs c except select * from _foto_costos)
     or exists (select * from _foto_precios except select batch_id, to_jsonb(p) from public.price_list p)
     or exists (select batch_id, to_jsonb(p) from public.price_list p except select * from _foto_precios) then
    raise exception 'La migración precio_sobre_lista cambió lotes, costeos o precios existentes: se cancela';
  end if;
end $$;

drop table _foto_lotes, _foto_costos, _foto_precios;
