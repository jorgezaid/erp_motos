-- =============================================================================
-- Precio final con descuento (D38, RN-25)
-- El precio de cada ítem sigue saliendo de price_list (RN-13), pero en borrador se puede
-- BAJAR con la RPC ajustar_precio_item:
--   · nunca por encima del precio de lista (solo descuentos)
--   · nunca por debajo del costo landing de la unidad (batch_model_costs)
--   · motivo obligatorio si el precio queda bajo el de lista
--   · vendedor: descuento ≤ configuracion_ventas.descuento_max_vendedor (por defecto 10 %);
--     admin: cualquier descuento hasta el costo landing
-- El vendedor nunca ve el costo: si el precio queda bajo el costo, el mensaje es genérico.
-- order_items sigue sin política de UPDATE: solo la RPC (security definer) cambia precios.
-- Al cambiar el tipo de venta se re-cotiza desde la lista y se descartan los ajustes.
-- =============================================================================

-- ---------------------------------------------------------------- configuración de ventas
-- Una sola fila (id = true). Lectura staff, escritura solo admin.
create table public.configuracion_ventas (
  id                      boolean primary key default true check (id),
  descuento_max_vendedor  numeric(5,4) not null default 0.10
                          check (descuento_max_vendedor >= 0 and descuento_max_vendedor < 1),
  updated_at              timestamptz not null default now()
);
insert into public.configuracion_ventas (id) values (true) on conflict (id) do nothing;

create trigger trg_updated_at before update on public.configuracion_ventas
  for each row execute function public.set_updated_at();

alter table public.configuracion_ventas enable row level security;
create policy "staff lee configuración de ventas" on public.configuracion_ventas
  for select to authenticated using ((select public.is_staff()));
create policy "admin edita configuración de ventas" on public.configuracion_ventas
  for update to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));

grant select, insert, update, delete on public.configuracion_ventas to authenticated;
grant all on public.configuracion_ventas to service_role;
revoke all on public.configuracion_ventas from anon;

-- ---------------------------------------------------------------- ítems: precio de lista y ajuste
alter table public.order_items
  add column precio_lista_pen numeric(14,2) not null default 0,
  add column motivo_ajuste    text,
  add column ajustado_por     uuid references public.profiles (id),
  add column ajustado_at      timestamptz;

update public.order_items set precio_lista_pen = precio_unitario_pen;

alter table public.order_items
  add constraint precio_no_supera_lista check (precio_unitario_pen <= precio_lista_pen),
  add constraint descuento_con_motivo check (
    precio_unitario_pen = precio_lista_pen or length(trim(coalesce(motivo_ajuste, ''))) > 0);

-- Agregar unidad: además del precio, fija el precio de lista y limpia cualquier ajuste
create or replace function public.order_item_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o public.sales_orders;
  v public.vehicle_inventory;
  v_batch_estado public.batch_status;
begin
  select * into o from public.sales_orders where id = new.order_id for update;
  if o.estado <> 'borrador' then
    raise exception 'La orden #% ya no es editable (estado: %)', o.numero, o.estado;
  end if;

  select * into v from public.vehicle_inventory where id = new.vehicle_id for update;
  if v.estado <> 'listo_en_tienda' then
    raise exception 'La unidad % no está disponible (estado: %)', v.vin_chasis, v.estado;
  end if;

  select b.estado into v_batch_estado from public.import_batches b where b.id = v.batch_id;
  if v_batch_estado <> 'liquidado' then
    raise exception 'La unidad % pertenece a un lote sin liquidar: aún no tiene costo ni precio', v.vin_chasis;
  end if;

  new.precio_unitario_pen := public.precio_unidad(v.id, o.tipo_venta);
  if new.precio_unitario_pen is null then
    raise exception 'No hay precio % para la unidad %', o.tipo_venta, v.vin_chasis;
  end if;
  new.precio_lista_pen := new.precio_unitario_pen;
  new.motivo_ajuste    := null;
  new.ajustado_por     := null;
  new.ajustado_at      := null;

  new.activo := true;
  return new;
end $$;

-- Igual que antes; la re-cotización (RN-13) ahora también renueva el precio de lista y
-- descarta los descuentos
create or replace function public.sales_order_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  it record;
  v_precio numeric;
begin
  -- Cambio de tipo de venta en borrador: se re-cotizan todas las unidades
  if new.tipo_venta <> old.tipo_venta and new.estado = 'borrador' then
    for it in select oi.id, oi.vehicle_id from public.order_items oi where oi.order_id = new.id and oi.activo loop
      v_precio := public.precio_unidad(it.vehicle_id, new.tipo_venta);
      if v_precio is null then
        raise exception 'Una unidad de la orden no tiene precio %', new.tipo_venta;
      end if;
      update public.order_items
      set precio_unitario_pen = v_precio, precio_lista_pen = v_precio,
          motivo_ajuste = null, ajustado_por = null, ajustado_at = null
      where id = it.id;
    end loop;
    update public.sales_orders set total_pen = public.recalcular_total_orden(new.id) where id = new.id;
  end if;

  -- Confirmada: unidades vendidas + garantías
  if new.estado = 'confirmada' and old.estado = 'borrador' then
    update public.vehicle_inventory v set estado = 'vendido'
    from public.order_items oi
    where oi.order_id = new.id and oi.activo and v.id = oi.vehicle_id;

    insert into public.warranties (vehicle_id, order_id, cobertura, fecha_inicio, fecha_fin)
    select oi.vehicle_id, new.id, c.cobertura, public.fecha_lima(),
           public.fecha_lima() + make_interval(months => c.meses)
    from public.order_items oi
    join public.vehicle_inventory v on v.id = oi.vehicle_id
    join public.vehicle_models m on m.id = v.model_id
    cross join lateral (values ('general'::public.warranty_coverage, m.garantia_meses),
                               ('baterias'::public.warranty_coverage, m.garantia_baterias_meses)) c(cobertura, meses)
    where oi.order_id = new.id and oi.activo and c.meses > 0;
  end if;

  -- Anulada: liberar unidades y anular garantías
  if new.estado = 'anulada' and old.estado <> 'anulada' then
    -- Primero se desactivan los ítems (así la unidad deja de estar "en orden viva")
    update public.order_items set activo = false where order_id = new.id and activo;

    update public.vehicle_inventory v set estado = 'listo_en_tienda'
    from public.order_items oi
    where oi.order_id = new.id and v.id = oi.vehicle_id and v.estado in ('reservado', 'vendido');

    update public.warranties set anulada = true where order_id = new.id;
  end if;

  return null;
end $$;

-- ---------------------------------------------------------------- RPC ajustar_precio_item
-- p_ajustes: [{ "item_id": uuid, "precio": número con hasta 2 decimales }], todos de p_order_id.
-- Todo o nada. Devuelve el nuevo total de la orden.
-- SECURITY DEFINER: el vendedor no puede leer batch_model_costs; los permisos se comprueban
-- aquí (can_edit_order: admin o el vendedor de la orden).
create function public.ajustar_precio_item(p_order_id uuid, p_ajustes jsonb, p_motivo text)
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
  v_admin   boolean := public.has_role('admin');
  v_motivo  text := nullif(trim(p_motivo), '');
  v_total   numeric;
begin
  if not (v_admin or public.has_role('vendedor')) then
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

  select descuento_max_vendedor into v_max from public.configuracion_ventas where id;
  v_max := coalesce(v_max, 0);

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
    if v_precio > it.precio_lista_pen then
      raise exception 'Unidad %: el precio final no puede superar el precio de lista (S/ %)', v_vin, it.precio_lista_pen;
    end if;
    if v_precio < it.precio_lista_pen and (v_motivo is null or length(v_motivo) < 5) then
      raise exception 'Indica el motivo del descuento (mínimo 5 caracteres)';
    end if;
    -- Límite del vendedor: no revela el costo
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
        motivo_ajuste = case when v_precio < it.precio_lista_pen then v_motivo end,
        ajustado_por  = case when v_precio < it.precio_lista_pen then auth.uid() end,
        ajustado_at   = case when v_precio < it.precio_lista_pen then now() end
    where id = it.id;
  end loop;

  -- sales_order_before_update recalcula total_pen desde los ítems
  update public.sales_orders set updated_at = now() where id = p_order_id
  returning total_pen into v_total;
  return jsonb_build_object('total', v_total);
end $$;

comment on function public.ajustar_precio_item(uuid, jsonb, text) is
  'D38: baja el precio final de ítems de una orden en borrador (≤ lista, ≥ costo landing, motivo si hay descuento, límite % para el vendedor).';

revoke execute on function public.ajustar_precio_item(uuid, jsonb, text) from public, anon;
grant execute on function public.ajustar_precio_item(uuid, jsonb, text) to authenticated, service_role;
