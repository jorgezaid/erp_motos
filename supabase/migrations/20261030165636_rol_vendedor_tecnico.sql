-- =============================================================================
-- Rol vendedor_tecnico (D42), parte 2/2: políticas y funciones
-- Una persona que arma las motos y también las vende: la UNIÓN de los permisos del técnico y
-- del vendedor, y nada más. Igual que ellos, no ve costos, márgenes, lotes, proveedores,
-- gastos ni usuarios (esas políticas son solo admin y no cambian).
--
-- Las listas de roles se reemplazan por dos funciones (incluyen al admin):
--   · public.puede_vender(): admin, vendedor, vendedor_tecnico
--   · public.puede_taller(): admin, tecnico, vendedor_tecnico
-- Las órdenes siguen siendo "las suyas": el vendedor_tecnico edita solo las que creó.
--
-- Matriz de acceso vigente (reemplaza la del encabezado de 20260925000300_seguridad_rls):
-- ┌─────────────────────────────┬────────┬───────────────┬──────────────────┬──────────────────┐
-- │ Tabla                       │ Admin  │ Técnico       │ Vendedor         │ Vendedor+Técnico │
-- ├─────────────────────────────┼────────┼───────────────┼──────────────────┼──────────────────┤
-- │ import_batches / items /    │ total  │ —             │ —                │ —                │
-- │ batch_model_costs (COSTOS)  │        │               │                  │                  │
-- │ proveedores, gastos         │ total  │ —             │ —                │ —                │
-- │ vehicle_models, locations   │ total  │ lectura       │ lectura          │ lectura          │
-- │ price_margins               │ total  │ lectura       │ lectura          │ lectura          │
-- │ price_list (precios)        │ total  │ —             │ lectura          │ lectura          │
-- │ vehicle_inventory           │ total  │ lee/crea/edita│ lectura          │ lee/crea/edita   │
-- │ vehicle_batteries           │ total  │ lee/crea/edita│ lectura          │ lee/crea/edita   │
-- │ technical_inspections       │ total  │ lee/crea      │ lectura          │ lee/crea         │
-- │ movimientos_ubicacion       │ lectura│ lectura       │ —                │ lectura          │
-- │ sales_orders/items/payments │ total  │ lectura       │ lee todo; crea/  │ lee todo; crea/  │
-- │                             │        │               │ edita las suyas  │ edita las suyas  │
-- │ warranties                  │ lectura│ lectura       │ lectura          │ lectura          │
-- │ warranty_claims             │ total  │ lee/crea/edita│ lee/crea         │ lee/crea/edita   │
-- └─────────────────────────────┴────────┴───────────────┴──────────────────┴──────────────────┘
-- RPC: listo_rapido, editar_color_unidad, mover_unidades y pendientes_de_registro →
-- puede_taller(); ajustar_precio_item → admin o puede_vender() (con el límite % del vendedor
-- para todo el que no es admin). Usuarios sin rol y `anon` no ven nada.
--
-- Cambios (los cuerpos de las funciones son los vigentes; solo cambia la comprobación del rol):
--   Políticas: price_list «admin y ventas leen precios»; vehicle_inventory «admin/técnico
--   registran» y «admin/técnico actualizan»; vehicle_batteries «admin/técnico gestionan
--   baterías»; technical_inspections «admin/técnico inspeccionan»; sales_orders «admin/ventas
--   crean órdenes», «admin o dueño edita orden» y «admin o dueño borra borrador»;
--   warranty_claims «admin/técnico atienden reclamos»; movimientos_ubicacion «admin/técnico
--   leen movimientos».
--   Funciones: can_edit_order, pendientes_de_registro, listo_rapido, ajustar_precio_item,
--   editar_color_unidad, mover_unidades.
-- =============================================================================

-- ---------------------------------------------------------------- funciones auxiliares
create function public.puede_vender() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role('admin', 'vendedor', 'vendedor_tecnico')
$$;

create function public.puede_taller() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role('admin', 'tecnico', 'vendedor_tecnico')
$$;

comment on function public.puede_vender() is 'D42: admin, vendedor o vendedor_tecnico (precios y ventas).';
comment on function public.puede_taller() is 'D42: admin, tecnico o vendedor_tecnico (registro, baterías, inspección, taller).';

revoke execute on function public.puede_vender() from public, anon;
revoke execute on function public.puede_taller() from public, anon;
grant execute on function public.puede_vender() to authenticated, service_role;
grant execute on function public.puede_taller() to authenticated, service_role;

-- ---------------------------------------------------------------- precios
drop policy "admin y ventas leen precios" on public.price_list;
create policy "admin y ventas leen precios" on public.price_list for select to authenticated
  using ((select public.puede_vender()));

-- ---------------------------------------------------------------- inventario y taller
drop policy "admin/técnico registran" on public.vehicle_inventory;
create policy "admin/técnico registran"      on public.vehicle_inventory for insert to authenticated
  with check ((select public.puede_taller()));

drop policy "admin/técnico actualizan" on public.vehicle_inventory;
create policy "admin/técnico actualizan"     on public.vehicle_inventory for update to authenticated
  using ((select public.puede_taller())) with check ((select public.puede_taller()));

drop policy "admin/técnico gestionan baterías" on public.vehicle_batteries;
create policy "admin/técnico gestionan baterías" on public.vehicle_batteries for all to authenticated
  using ((select public.puede_taller())) with check ((select public.puede_taller()));

drop policy "admin/técnico inspeccionan" on public.technical_inspections;
create policy "admin/técnico inspeccionan"   on public.technical_inspections for insert to authenticated
  with check ((select public.puede_taller()));

drop policy "admin/técnico leen movimientos" on public.movimientos_ubicacion;
create policy "admin/técnico leen movimientos" on public.movimientos_ubicacion for select to authenticated
  using ((select public.puede_taller()));

-- ---------------------------------------------------------------- ventas
drop policy "admin/ventas crean órdenes" on public.sales_orders;
create policy "admin/ventas crean órdenes"   on public.sales_orders for insert to authenticated
  with check ((select public.puede_vender()));

drop policy "admin o dueño edita orden" on public.sales_orders;
create policy "admin o dueño edita orden"    on public.sales_orders for update to authenticated
  using ((select public.has_role('admin'))
         or ((select public.puede_vender()) and vendedor_id = (select auth.uid())))
  with check ((select public.has_role('admin'))
         or ((select public.puede_vender()) and vendedor_id = (select auth.uid())));

drop policy "admin o dueño borra borrador" on public.sales_orders;
create policy "admin o dueño borra borrador" on public.sales_orders for delete to authenticated
  using (estado = 'borrador' and ((select public.has_role('admin'))
         or ((select public.puede_vender()) and vendedor_id = (select auth.uid()))));

-- Ítems y pagos: se crean/borran si puedes editar la orden
create or replace function public.can_edit_order(p_order_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sales_orders o
    where o.id = p_order_id
      and (public.has_role('admin')
           or (public.puede_vender() and o.vendedor_id = auth.uid())))
$$;

-- ---------------------------------------------------------------- garantías
drop policy "admin/técnico atienden reclamos" on public.warranty_claims;
create policy "admin/técnico atienden reclamos" on public.warranty_claims for update to authenticated
  using ((select public.puede_taller())) with check ((select public.puede_taller()));

-- ---------------------------------------------------------------- pendientes_de_registro
-- Para el técnico (que no ve costos ni lotes): qué falta registrar por lote/modelo
create or replace function public.pendientes_de_registro()
returns table (batch_id uuid, codigo_embarque text, estado_lote public.batch_status,
               model_id uuid, codigo_modelo text, declaradas int, registradas int)
language sql stable security definer set search_path = '' as $$
  select b.id, b.codigo_embarque, b.estado, m.id, m.codigo_modelo, i.cantidad_packing_list,
         (select count(*)::int from public.vehicle_inventory v
           where v.batch_id = i.batch_id and v.model_id = i.model_id)
  from public.batch_items i
  join public.import_batches b on b.id = i.batch_id
  join public.vehicle_models m on m.id = i.model_id
  where public.puede_taller() or public.is_privileged()
  order by b.created_at desc, m.codigo_modelo
$$;

-- ---------------------------------------------------------------- listo_rapido (D37)
create or replace function public.listo_rapido(p_unidades jsonb, p_location_id uuid)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  u              jsonb;
  s              jsonb;
  v              public.vehicle_inventory;
  v_vin          text;
  v_esperadas    int;
  v_registradas  int;
  v_pos          int;
  v_serial       text;
  v_dados        jsonb;
  n_unidades     int := 0;
  n_provisional  int := 0;
  n_baterias     int := 0;
  v_restriccion  text;
  v_mensaje      text;
begin
  if not public.puede_taller() then
    raise exception 'Solo un administrador o un técnico puede usar Listo rápido' using errcode = '42501';
  end if;
  if jsonb_typeof(p_unidades) is distinct from 'array' or jsonb_array_length(p_unidades) = 0 then
    raise exception 'Elige al menos una moto';
  end if;
  if jsonb_array_length(p_unidades) > 100 then
    raise exception 'Listo rápido admite hasta 100 motos a la vez';
  end if;
  if p_location_id is null or not exists (
       select 1 from public.locations where id = p_location_id and activo) then
    raise exception 'Elige una ubicación en tienda activa';
  end if;

  begin
    for u in select * from jsonb_array_elements(p_unidades) loop
      v_vin := null;
      select * into v from public.vehicle_inventory where id = (u ->> 'vehicle_id')::uuid for update;
      if not found then
        raise exception 'Una de las motos no existe o no tienes permiso para verla';
      end if;
      v_vin := v.vin_chasis;

      if v.estado not in ('en_caja', 'en_ensamble') then
        raise exception 'Solo se aplica a motos en caja o en ensamble (estado actual: %)', v.estado;
      end if;

      -- 1. en_caja → en_ensamble
      if v.estado = 'en_caja' then
        update public.vehicle_inventory set estado = 'en_ensamble' where id = v.id;
        if not found then raise exception 'No tienes permiso para mover esta moto'; end if;
      end if;

      -- 2. Baterías que faltan, en las posiciones libres
      select m.cantidad_baterias_12v into v_esperadas
      from public.vehicle_models m where m.id = v.model_id;
      select count(*) into v_registradas from public.vehicle_batteries where vehicle_id = v.id;

      v_dados := coalesce(u -> 'seriales', '[]'::jsonb);
      for s in select * from jsonb_array_elements(v_dados) loop
        if nullif(trim(s ->> 'serial'), '') is null then continue; end if;
        if upper(trim(s ->> 'serial')) like 'PROV-%' then
          raise exception 'el prefijo PROV- está reservado a los seriales provisionales (%)', upper(trim(s ->> 'serial'));
        end if;
        if exists (select 1 from public.vehicle_batteries
                   where vehicle_id = v.id and posicion = (s ->> 'posicion')::int) then
          raise exception 'la posición % ya tiene una batería registrada', s ->> 'posicion';
        end if;
      end loop;

      v_pos := 0;
      while v_registradas < v_esperadas loop
        v_pos := v_pos + 1;
        if v_pos > 6 then
          raise exception 'no quedan posiciones libres para las baterías';
        end if;
        continue when exists (select 1 from public.vehicle_batteries where vehicle_id = v.id and posicion = v_pos);

        select nullif(upper(trim(x ->> 'serial')), '') into v_serial
        from jsonb_array_elements(v_dados) x
        where (x ->> 'posicion')::int = v_pos
        limit 1;
        if v_serial is null then
          v_serial := 'PROV-' || v.vin_chasis || '-' || v_pos;
          n_provisional := n_provisional + 1;
        end if;

        insert into public.vehicle_batteries (vehicle_id, posicion, serial) values (v.id, v_pos, v_serial);
        v_registradas := v_registradas + 1;
        n_baterias := n_baterias + 1;
      end loop;

      -- 3. Inspección con todo el checklist marcado
      insert into public.technical_inspections
        (vehicle_id, baterias_esperadas, baterias_contadas, vin_verificado, motor_verificado,
         checklist, observaciones)
      values
        (v.id, 0, v_registradas, true, true,
         jsonb_build_object('frenos', true, 'luces', true, 'claxon', true, 'listo_rapido', true),
         'Listo rápido');

      -- 4. en_ensamble → listo_en_tienda
      update public.vehicle_inventory
      set estado = 'listo_en_tienda', location_id = p_location_id
      where id = v.id and estado = 'en_ensamble';
      if not found then raise exception 'No tienes permiso para mover esta moto'; end if;

      n_unidades := n_unidades + 1;
    end loop;
  exception when others then
    get stacked diagnostics v_restriccion = constraint_name;
    v_mensaje := case
      when sqlstate = '23505' and v_restriccion = 'vehicle_batteries_serial_key'
        then 'un serial de batería está repetido o ya está registrado'
      when sqlstate = '23505' and v_restriccion = 'vehicle_batteries_vehicle_id_posicion_key'
        then 'esa posición ya tiene una batería registrada'
      when sqlstate = '22P02' then 'un dato no tiene el formato esperado'
      else sqlerrm end;
    if v_vin is not null and position(v_vin in v_mensaje) = 0 then
      v_mensaje := format('Moto %s: %s', v_vin, v_mensaje);
    end if;
    raise exception '%', v_mensaje using errcode = case when sqlstate = '42501' then '42501' else 'P0001' end;
  end;

  return jsonb_build_object('unidades', n_unidades, 'baterias', n_baterias, 'provisionales', n_provisional);
end $$;

-- ---------------------------------------------------------------- ajustar_precio_item (D38)
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

-- ---------------------------------------------------------------- editar_color_unidad (D39)
create or replace function public.editar_color_unidad(p_vehicle_id uuid, p_primario text, p_secundario text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v           public.vehicle_inventory;
  v_primario  text := public.normalizar_color(p_primario);
  v_secundario text := public.normalizar_color(p_secundario);
begin
  if not public.puede_taller() then
    raise exception 'Solo un administrador o un técnico puede cambiar el color' using errcode = '42501';
  end if;
  if v_primario is null then
    raise exception 'Indica el color primario';
  end if;
  if length(v_primario) > 30 or length(coalesce(v_secundario, '')) > 30 then
    raise exception 'Cada color tiene como máximo 30 caracteres';
  end if;
  if v_primario = v_secundario then
    raise exception 'El color secundario debe ser distinto del primario';
  end if;

  select * into v from public.vehicle_inventory where id = p_vehicle_id for update;
  if not found then
    raise exception 'La unidad no existe';
  end if;
  if v.estado = 'vendido' and not public.has_role('admin') then
    raise exception 'Solo un administrador puede corregir el color de una moto vendida' using errcode = '42501';
  end if;

  update public.vehicle_inventory
  set color_primario = v_primario, color_secundario = v_secundario
  where id = p_vehicle_id;

  return jsonb_build_object('color_primario', v_primario, 'color_secundario', v_secundario);
end $$;

-- ---------------------------------------------------------------- mover_unidades (D40)
create or replace function public.mover_unidades(p_vehicle_ids uuid[], p_location_id uuid)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_ids   uuid[] := array(select distinct x from unnest(p_vehicle_ids) x);
  v_vin   text;
  v_n     int;
begin
  if not public.puede_taller() then
    raise exception 'Solo un administrador o un técnico puede mover motos' using errcode = '42501';
  end if;
  if coalesce(cardinality(v_ids), 0) = 0 then
    raise exception 'Selecciona al menos una moto';
  end if;
  if cardinality(v_ids) > 500 then
    raise exception 'Se pueden mover como máximo 500 motos a la vez';
  end if;
  if p_location_id is null or not exists (
       select 1 from public.locations where id = p_location_id and activo) then
    raise exception 'Elige una ubicación activa';
  end if;

  -- Bloquea todas las motos en un orden fijo (evita interbloqueos entre dos movimientos)
  perform 1 from public.vehicle_inventory where id = any (v_ids) order by id for update;
  if (select count(*) from public.vehicle_inventory where id = any (v_ids)) <> cardinality(v_ids) then
    raise exception 'Alguna de las motos no existe';
  end if;

  select vin_chasis into v_vin from public.vehicle_inventory
  where id = any (v_ids) and estado = 'vendido' order by vin_chasis limit 1;
  if found then
    raise exception 'La moto % ya está vendida: no se puede mover', v_vin;
  end if;

  update public.vehicle_inventory
  set location_id = p_location_id
  where id = any (v_ids) and location_id is distinct from p_location_id;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- create or replace conserva los grants; se repiten por claridad (test_grants.sql)
revoke execute on function public.can_edit_order(uuid) from public, anon;
revoke execute on function public.pendientes_de_registro() from public, anon;
revoke execute on function public.listo_rapido(jsonb, uuid) from public, anon;
revoke execute on function public.ajustar_precio_item(uuid, jsonb, text) from public, anon;
revoke execute on function public.editar_color_unidad(uuid, text, text) from public, anon;
revoke execute on function public.mover_unidades(uuid[], uuid) from public, anon;
