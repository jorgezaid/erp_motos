-- =============================================================================
-- ERP Vehículos Eléctricos — Migración 2/3: Reglas de negocio, triggers y vistas
-- =============================================================================
-- La base de datos es la última línea de defensa: aunque el frontend tenga un
-- bug o alguien llame a la API directamente, estas reglas no se pueden saltar.
--
-- Funciones SECURITY DEFINER: siempre con `set search_path = ''` y nombres
-- totalmente calificados (recomendación de seguridad de Supabase).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Utilidades generales
-- -----------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_updated_at before update on public.profiles          for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.vehicle_models    for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.import_batches    for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.vehicle_inventory for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.sales_orders      for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.warranty_claims   for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.price_margins     for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.price_list        for each row execute function public.set_updated_at();

-- Fecha de negocio en hora de Perú (el servidor de Supabase corre en UTC)
create function public.fecha_lima() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Lima')::date
$$;

-- -----------------------------------------------------------------------------
-- 2. Roles
-- -----------------------------------------------------------------------------
create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.rol from public.profiles p where p.id = auth.uid() and p.activo
$$;

create function public.has_role(variadic roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = any (roles), false)
$$;

-- Admin, o un proceso de backend (service_role / conexión directa sin JWT)
create function public.is_privileged() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role('admin') or coalesce(auth.role(), 'service_role') = 'service_role'
$$;

-- Perfil automático al registrarse en Supabase Auth (sin rol hasta aprobación)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1), ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nadie puede auto-asignarse un rol ni reactivarse
create function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.rol is distinct from old.rol or new.activo is distinct from old.activo)
     and not public.is_privileged() then
    raise exception 'Solo un administrador puede cambiar roles o activar usuarios'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger trg_guard_profile before update on public.profiles
  for each row execute function public.guard_profile_update();

-- -----------------------------------------------------------------------------
-- 3. Lotes de importación
-- -----------------------------------------------------------------------------

-- Snapshot de EXW y CBM desde el catálogo si no se envían
create function public.batch_items_defaults() returns trigger
language plpgsql set search_path = '' as $$
declare m public.vehicle_models;
begin
  select * into m from public.vehicle_models where id = new.model_id;
  new.exw_usd_unitario     := coalesce(new.exw_usd_unitario, m.exw_usd_unitario);
  new.volumen_cbm_unitario := coalesce(new.volumen_cbm_unitario, m.volumen_cbm_unitario);
  return new;
end $$;

create trigger trg_batch_items_defaults before insert on public.batch_items
  for each row execute function public.batch_items_defaults();

-- Un lote liquidado queda CONGELADO: no se tocan sus líneas ni sus costos
create function public.guard_batch_not_liquidated() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_batch uuid := case when tg_op = 'DELETE' then old.batch_id else new.batch_id end;
begin
  if exists (select 1 from public.import_batches b where b.id = v_batch and b.estado = 'liquidado') then
    raise exception 'El lote está liquidado: reábralo antes de modificar %', tg_table_name
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger trg_guard_liquidated before insert or update or delete on public.batch_items
  for each row execute function public.guard_batch_not_liquidated();
create trigger trg_guard_liquidated before insert or update or delete on public.batch_model_costs
  for each row execute function public.guard_batch_not_liquidated();

-- Genera / actualiza la matriz de precios de un lote:  Precio = Costo / (1 - Margen)
-- Conserva los precios manuales (precio_manual_pen).
create function public.generar_lista_precios(p_batch_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_privileged() then
    raise exception 'Solo un administrador puede generar precios' using errcode = '42501';
  end if;

  insert into public.price_list (batch_id, model_id, tipo_venta, precio_sugerido_pen)
  select c.batch_id, c.model_id, m.tipo_venta,
         round(c.costo_landing_unitario_pen / (1 - m.margen_objetivo), 2)
  from public.batch_model_costs c
  cross join public.price_margins m
  where c.batch_id = p_batch_id
  on conflict (batch_id, model_id, tipo_venta)
  do update set precio_sugerido_pen = excluded.precio_sugerido_pen;
end $$;

-- Reglas de transición del lote
create function public.guard_batch_update() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_faltantes int;
begin
  -- a) Lote liquidado y sigue liquidado: solo se pueden editar notas
  if old.estado = 'liquidado' and new.estado = 'liquidado' then
    -- (las columnas generadas llegan nulas a un trigger BEFORE: se excluyen)
    if (to_jsonb(new) - array['notas', 'updated_at', 'impuestos_sunat_pen',
                              'impuestos_asignables_pen', 'gastos_operativos_fijos_pen'])
       is distinct from
       (to_jsonb(old) - array['notas', 'updated_at', 'impuestos_sunat_pen',
                              'impuestos_asignables_pen', 'gastos_operativos_fijos_pen']) then
      raise exception 'Lote % liquidado: sus costos están congelados. Reábralo para editar.', old.codigo_embarque;
    end if;
    return new;
  end if;

  -- b) Reapertura de un lote liquidado
  if old.estado = 'liquidado' and new.estado <> 'liquidado' then
    if exists (select 1 from public.vehicle_inventory v
               where v.batch_id = old.id and v.estado in ('reservado', 'vendido')) then
      raise exception 'No se puede reabrir el lote %: tiene unidades reservadas o vendidas', old.codigo_embarque;
    end if;
    new.liquidado_at  := null;
    new.liquidado_por := null;
    return new;
  end if;

  -- c) Liquidación: exige tipo de cambio y un costo calculado por cada línea
  if new.estado = 'liquidado' then
    if new.tipo_cambio is null then
      raise exception 'Falta el tipo de cambio para liquidar el lote %', new.codigo_embarque;
    end if;

    if not exists (select 1 from public.batch_items i where i.batch_id = new.id) then
      raise exception 'El lote % no tiene líneas de packing list', new.codigo_embarque;
    end if;

    select count(*) into v_faltantes
    from public.batch_items i
    left join public.batch_model_costs c on c.batch_id = i.batch_id and c.model_id = i.model_id
    where i.batch_id = new.id
      and (c.batch_id is null
           or c.cantidad    <> i.cantidad_packing_list
           or c.tipo_cambio <> new.tipo_cambio);

    if v_faltantes > 0 then
      raise exception 'Lote %: % modelo(s) sin costeo vigente. Ejecute el prorrateo antes de liquidar.',
        new.codigo_embarque, v_faltantes;
    end if;

    new.liquidado_at  := now();
    new.liquidado_por := auth.uid();
  end if;

  return new;
end $$;

create trigger trg_guard_batch before update on public.import_batches
  for each row execute function public.guard_batch_update();

-- Al liquidar, se genera automáticamente la matriz de precios
create function public.after_batch_liquidated() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.generar_lista_precios(new.id);
  return null;
end $$;

create trigger trg_after_batch_liquidated after update of estado on public.import_batches
  for each row when (new.estado = 'liquidado' and old.estado is distinct from 'liquidado')
  execute function public.after_batch_liquidated();

create function public.guard_batch_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.estado = 'liquidado' then
    raise exception 'No se puede eliminar un lote liquidado';
  end if;
  return old;
end $$;

create trigger trg_guard_batch_delete before delete on public.import_batches
  for each row execute function public.guard_batch_delete();

-- Si cambian los márgenes, se recalculan los precios de todos los lotes liquidados
create function public.after_margins_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b record;
begin
  for b in select id from public.import_batches where estado = 'liquidado' loop
    perform public.generar_lista_precios(b.id);
  end loop;
  return null;
end $$;

create trigger trg_after_margins_changed after update on public.price_margins
  for each statement execute function public.after_margins_changed();

-- -----------------------------------------------------------------------------
-- 4. Inventario, baterías e inspección técnica
-- -----------------------------------------------------------------------------

-- No registrar más unidades que las declaradas en el packing list
create function public.guard_vehicle_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_declaradas int;
  v_registradas int;
begin
  if new.estado not in ('en_caja', 'en_ensamble') then
    raise exception 'Una unidad nueva debe ingresar como en_caja o en_ensamble';
  end if;

  select i.cantidad_packing_list into v_declaradas
  from public.batch_items i
  where i.batch_id = new.batch_id and i.model_id = new.model_id
  for update;                                   -- serializa registros concurrentes

  select count(*) into v_registradas
  from public.vehicle_inventory v
  where v.batch_id = new.batch_id and v.model_id = new.model_id;

  if v_registradas >= v_declaradas then
    raise exception 'El packing list declara % unidad(es) de este modelo y ya están registradas todas', v_declaradas;
  end if;

  new.vin_chasis := upper(trim(new.vin_chasis));
  new.nro_motor  := upper(trim(new.nro_motor));
  return new;
end $$;

create trigger trg_guard_vehicle_insert before insert on public.vehicle_inventory
  for each row execute function public.guard_vehicle_insert();

-- Máquina de estados de la unidad
--   en_caja ⇄ en_ensamble ⇄ listo_en_tienda ⇄ reservado → vendido
--   (vendido → listo_en_tienda solo por anulación de la venta)
create function public.guard_vehicle_update() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_esperadas   int;
  v_registradas int;
  v_aprobada    boolean;
begin
  -- Identidad inmutable una vez en proceso de venta
  if old.estado in ('reservado', 'vendido')
     and (new.vin_chasis, new.nro_motor, new.batch_id, new.model_id)
         is distinct from (old.vin_chasis, old.nro_motor, old.batch_id, old.model_id) then
    raise exception 'No se puede cambiar VIN, motor, lote ni modelo de una unidad reservada o vendida';
  end if;

  new.vin_chasis := upper(trim(new.vin_chasis));
  new.nro_motor  := upper(trim(new.nro_motor));

  if new.estado = old.estado then
    return new;
  end if;

  if not (
       (old.estado = 'en_caja'         and new.estado = 'en_ensamble')
    or (old.estado = 'en_ensamble'     and new.estado in ('en_caja', 'listo_en_tienda'))
    or (old.estado = 'listo_en_tienda' and new.estado in ('en_ensamble', 'reservado'))
    or (old.estado = 'reservado'       and new.estado in ('listo_en_tienda', 'vendido'))
    or (old.estado = 'vendido'         and new.estado = 'listo_en_tienda')
  ) then
    raise exception 'Transición no permitida: % → %', old.estado, new.estado;
  end if;

  -- Pasar a tienda exige: baterías completas + última inspección aprobada + ubicación
  if new.estado = 'listo_en_tienda' and old.estado = 'en_ensamble' then
    select m.cantidad_baterias_12v into v_esperadas
    from public.vehicle_models m where m.id = new.model_id;

    select count(*) into v_registradas
    from public.vehicle_batteries b where b.vehicle_id = new.id;

    if v_registradas <> v_esperadas then
      raise exception 'Unidad %: tiene % serial(es) de batería registrados; el modelo exige %',
        new.vin_chasis, v_registradas, v_esperadas;
    end if;

    select t.aprobada into v_aprobada
    from public.technical_inspections t
    where t.vehicle_id = new.id
    order by t.created_at desc
    limit 1;

    if v_aprobada is distinct from true then
      raise exception 'Unidad %: requiere una inspección técnica aprobada (la última está observada o no existe)',
        new.vin_chasis;
    end if;

    if new.location_id is null then
      raise exception 'Unidad %: asigne una ubicación antes de pasarla a tienda', new.vin_chasis;
    end if;
  end if;

  -- Reservado / vendido solo a través de una orden de venta
  if new.estado = 'reservado' and not exists (
       select 1 from public.order_items oi join public.sales_orders o on o.id = oi.order_id
       where oi.vehicle_id = new.id and oi.activo and o.estado = 'borrador') then
    raise exception 'Una unidad solo se reserva agregándola a una orden de venta';
  end if;

  if new.estado = 'vendido' and not exists (
       select 1 from public.order_items oi join public.sales_orders o on o.id = oi.order_id
       where oi.vehicle_id = new.id and oi.activo and o.estado = 'confirmada') then
    raise exception 'Una unidad solo se marca vendida confirmando su orden de venta';
  end if;

  -- Liberar (reservado/vendido → tienda) solo si ya no está en una orden viva
  if old.estado in ('reservado', 'vendido') and new.estado = 'listo_en_tienda' and exists (
       select 1 from public.order_items oi where oi.vehicle_id = new.id and oi.activo) then
    raise exception 'La unidad % sigue en una orden de venta activa; quítela o anule la orden', new.vin_chasis;
  end if;

  return new;
end $$;

create trigger trg_guard_vehicle_update before update on public.vehicle_inventory
  for each row execute function public.guard_vehicle_update();

-- Para el técnico (que no ve costos ni lotes): qué falta registrar por lote/modelo
create function public.pendientes_de_registro()
returns table (batch_id uuid, codigo_embarque text, estado_lote public.batch_status,
               model_id uuid, codigo_modelo text, declaradas int, registradas int)
language sql stable security definer set search_path = '' as $$
  select b.id, b.codigo_embarque, b.estado, m.id, m.codigo_modelo, i.cantidad_packing_list,
         (select count(*)::int from public.vehicle_inventory v
           where v.batch_id = i.batch_id and v.model_id = i.model_id)
  from public.batch_items i
  join public.import_batches b on b.id = i.batch_id
  join public.vehicle_models m on m.id = i.model_id
  where public.has_role('admin', 'tecnico') or public.is_privileged()
  order by b.created_at desc, m.codigo_modelo
$$;

-- Historial de estados/ubicación
create function public.log_vehicle_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT'
     or new.estado is distinct from old.estado
     or new.location_id is distinct from old.location_id then
    insert into public.vehicle_status_history (vehicle_id, estado_anterior, estado_nuevo, location_id)
    values (new.id, case when tg_op = 'UPDATE' then old.estado end, new.estado, new.location_id);
  end if;
  return null;
end $$;

create trigger trg_log_vehicle_status after insert or update on public.vehicle_inventory
  for each row execute function public.log_vehicle_status();

-- Baterías: nunca más seriales que los que exige el voltaje del modelo
create function public.guard_battery() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_esperadas int;
  v_actuales  int;
begin
  -- Bloquea la unidad para que dos técnicos no excedan el límite a la vez
  perform 1 from public.vehicle_inventory where id = new.vehicle_id for update;

  select m.cantidad_baterias_12v into v_esperadas
  from public.vehicle_inventory v join public.vehicle_models m on m.id = v.model_id
  where v.id = new.vehicle_id;

  select count(*) into v_actuales
  from public.vehicle_batteries b
  where b.vehicle_id = new.vehicle_id and b.id <> new.id;

  if v_actuales >= v_esperadas then
    raise exception 'El modelo usa % baterías de 12V (%V); esta unidad ya las tiene todas registradas',
      v_esperadas, v_esperadas * 12;
  end if;

  new.serial := upper(trim(new.serial));
  return new;
end $$;

create trigger trg_guard_battery before insert or update on public.vehicle_batteries
  for each row execute function public.guard_battery();

-- Inspección: las baterías esperadas las fija el sistema, no el usuario
create function public.inspection_defaults() returns trigger
language plpgsql set search_path = '' as $$
declare v_estado public.vehicle_status;
begin
  select v.estado, m.cantidad_baterias_12v into v_estado, new.baterias_esperadas
  from public.vehicle_inventory v join public.vehicle_models m on m.id = v.model_id
  where v.id = new.vehicle_id;

  if v_estado not in ('en_ensamble', 'listo_en_tienda') then
    raise exception 'Solo se inspeccionan unidades en ensamble o en tienda (estado actual: %)', v_estado;
  end if;

  new.inspector_id := coalesce(auth.uid(), new.inspector_id);
  new.created_at   := now();
  return new;
end $$;

create trigger trg_inspection_defaults before insert on public.technical_inspections
  for each row execute function public.inspection_defaults();

-- -----------------------------------------------------------------------------
-- 5. Ventas
-- -----------------------------------------------------------------------------
create function public.recalcular_total_orden(p_order_id uuid) returns numeric
language sql stable set search_path = '' as $$
  select coalesce(sum(oi.precio_unitario_pen), 0)::numeric(14,2)
  from public.order_items oi
  where oi.order_id = p_order_id and oi.activo
$$;

create function public.precio_unidad(p_vehicle_id uuid, p_tipo public.sale_type) returns numeric
language sql stable security definer set search_path = '' as $$
  select pl.precio_venta_pen
  from public.vehicle_inventory v
  join public.price_list pl on pl.batch_id = v.batch_id and pl.model_id = v.model_id
  where v.id = p_vehicle_id and pl.tipo_venta = p_tipo
$$;

-- Agregar unidad a la orden: valida y fija el precio desde la matriz
create function public.order_item_before_insert() returns trigger
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

  new.activo := true;
  return new;
end $$;

create function public.order_item_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.vehicle_inventory set estado = 'reservado' where id = new.vehicle_id;
  update public.sales_orders set total_pen = public.recalcular_total_orden(new.order_id) where id = new.order_id;
  return null;
end $$;

create function public.order_item_before_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_estado public.order_status;
begin
  select estado into v_estado from public.sales_orders where id = old.order_id;
  -- v_estado nulo = la orden se está borrando en cascada
  if v_estado is not null and v_estado <> 'borrador' then
    raise exception 'Solo se quitan unidades de órdenes en borrador';
  end if;
  return old;
end $$;

create function public.order_item_after_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.activo then
    update public.vehicle_inventory set estado = 'listo_en_tienda'
    where id = old.vehicle_id and estado = 'reservado';
  end if;
  update public.sales_orders set total_pen = public.recalcular_total_orden(old.order_id) where id = old.order_id;
  return null;
end $$;

create trigger trg_order_item_bi before insert on public.order_items for each row execute function public.order_item_before_insert();
create trigger trg_order_item_ai after  insert on public.order_items for each row execute function public.order_item_after_insert();
create trigger trg_order_item_bd before delete on public.order_items for each row execute function public.order_item_before_delete();
create trigger trg_order_item_ad after  delete on public.order_items for each row execute function public.order_item_after_delete();

-- Pagos solo mientras la orden está en borrador
create function public.guard_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_estado public.order_status;
begin
  select estado into v_estado from public.sales_orders
  where id = case when tg_op = 'DELETE' then old.order_id else new.order_id end;
  if v_estado is not null and v_estado <> 'borrador' then
    raise exception 'La orden ya no admite cambios en pagos (estado: %)', v_estado;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger trg_guard_payment before insert or delete on public.payments
  for each row execute function public.guard_payment();

-- Orden: valores controlados por el sistema al crear
create function public.sales_order_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.estado        := 'borrador';
  new.total_pen     := 0;
  new.metodo_pago   := null;
  new.confirmada_at := null;
  new.anulada_at    := null;
  if not public.is_privileged() then
    new.vendedor_id := auth.uid();
  end if;
  new.cliente_documento := upper(trim(new.cliente_documento));
  return new;
end $$;

create trigger trg_sales_order_bi before insert on public.sales_orders
  for each row execute function public.sales_order_before_insert();

-- Orden: confirmación, anulación y protección de campos calculados
create function public.sales_order_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_items    int;
  v_minimo   int;
  v_pagado   numeric(14,2);
  v_metodos  int;
  v_metodo   public.payment_method;
begin
  if old.estado = 'anulada' then
    raise exception 'La orden #% está anulada y no puede modificarse', old.numero;
  end if;

  -- Campos que el cliente nunca controla
  new.total_pen := public.recalcular_total_orden(old.id);
  if not public.is_privileged() then
    new.vendedor_id := old.vendedor_id;
  end if;
  if new.estado = old.estado then
    new.metodo_pago   := old.metodo_pago;
    new.confirmada_at := old.confirmada_at;
    new.anulada_at    := old.anulada_at;
  end if;

  if old.estado = 'confirmada' and new.estado = 'confirmada' then
    -- Una venta confirmada solo admite actualizar datos de contacto
    if (to_jsonb(new) - array['cliente_telefono', 'cliente_email', 'updated_at'])
       is distinct from (to_jsonb(old) - array['cliente_telefono', 'cliente_email', 'updated_at']) then
      raise exception 'La orden #% está confirmada; para corregirla, anúlela y cree una nueva', old.numero;
    end if;
  end if;

  if new.tipo_venta <> old.tipo_venta and old.estado <> 'borrador' then
    raise exception 'El tipo de venta solo se cambia en borrador';
  end if;

  if old.estado = 'confirmada' and new.estado = 'borrador' then
    raise exception 'Una orden confirmada no puede volver a borrador';
  end if;

  -- CONFIRMAR
  if old.estado = 'borrador' and new.estado = 'confirmada' then
    select count(*) into v_items from public.order_items where order_id = old.id and activo;
    select cantidad_minima into v_minimo from public.price_margins where tipo_venta = new.tipo_venta;

    if v_items = 0 then
      raise exception 'La orden no tiene unidades';
    end if;
    if v_items < v_minimo then
      raise exception 'Venta % exige mínimo % unidades; la orden tiene %', new.tipo_venta, v_minimo, v_items;
    end if;

    select coalesce(sum(monto_pen), 0), count(distinct metodo), min(metodo::text)::public.payment_method
      into v_pagado, v_metodos, v_metodo
    from public.payments where order_id = old.id;

    if v_pagado <> new.total_pen then
      raise exception 'Pagos registrados S/ % no cuadran con el total S/ %', v_pagado, new.total_pen;
    end if;

    new.metodo_pago   := case when v_metodos > 1 then 'mixto' else v_metodo end;
    new.confirmada_at := now();
  end if;

  -- ANULAR
  if new.estado = 'anulada' then
    if old.estado = 'confirmada' and not public.is_privileged() then
      raise exception 'Solo un administrador puede anular una venta confirmada' using errcode = '42501';
    end if;
    new.total_pen  := old.total_pen;    -- se conserva el monto histórico
    new.anulada_at := now();
  end if;

  return new;
end $$;

create trigger trg_sales_order_bu before update on public.sales_orders
  for each row execute function public.sales_order_before_update();

create function public.sales_order_after_update() returns trigger
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
      update public.order_items set precio_unitario_pen = v_precio where id = it.id;
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

create trigger trg_sales_order_au after update on public.sales_orders
  for each row execute function public.sales_order_after_update();

create function public.guard_order_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.estado <> 'borrador' then
    raise exception 'Solo se eliminan órdenes en borrador; las confirmadas se anulan';
  end if;
  return old;
end $$;

create trigger trg_guard_order_delete before delete on public.sales_orders
  for each row execute function public.guard_order_delete();

-- -----------------------------------------------------------------------------
-- 6. Garantías
-- -----------------------------------------------------------------------------
create function public.guard_warranty_claim() returns trigger
language plpgsql set search_path = '' as $$
declare w public.warranties;
begin
  select * into w from public.warranties where id = new.warranty_id;
  if w.anulada then
    raise exception 'La garantía fue anulada junto con su venta';
  end if;
  if public.fecha_lima() not between w.fecha_inicio and w.fecha_fin then
    raise exception 'Garantía vencida el %', w.fecha_fin;
  end if;
  return new;
end $$;

create trigger trg_guard_warranty_claim before insert on public.warranty_claims
  for each row execute function public.guard_warranty_claim();

-- -----------------------------------------------------------------------------
-- 7. Vistas (security_invoker: respetan el RLS de quien consulta)
-- -----------------------------------------------------------------------------

-- Costo landing por unidad física (solo admin, por RLS de batch_model_costs)
create view public.v_vehicle_costs with (security_invoker = true) as
select v.id as vehicle_id, v.vin_chasis, v.nro_motor, v.estado,
       b.codigo_embarque, m.codigo_modelo,
       c.costo_landing_unitario_pen as costo_landing_calculado_pen
from public.vehicle_inventory v
join public.import_batches b   on b.id = v.batch_id
join public.vehicle_models m   on m.id = v.model_id
left join public.batch_model_costs c on c.batch_id = v.batch_id and c.model_id = v.model_id;

-- Matriz de precios completa con costo y utilidad (solo admin)
create view public.v_price_matrix with (security_invoker = true) as
select b.id as batch_id, b.codigo_embarque, m.id as model_id, m.codigo_modelo, m.categoria,
       c.cantidad, c.costo_landing_unitario_pen,
       max(pl.precio_venta_pen) filter (where pl.tipo_venta = 'unidad_x1')       as precio_x1,
       max(pl.precio_venta_pen) filter (where pl.tipo_venta = 'mayorista_x3')    as precio_x3,
       max(pl.precio_venta_pen) filter (where pl.tipo_venta = 'distribuidor_x6') as precio_x6,
       max(pl.precio_venta_pen) filter (where pl.tipo_venta = 'unidad_x1')       - c.costo_landing_unitario_pen as utilidad_x1,
       max(pl.precio_venta_pen) filter (where pl.tipo_venta = 'mayorista_x3')    - c.costo_landing_unitario_pen as utilidad_x3,
       max(pl.precio_venta_pen) filter (where pl.tipo_venta = 'distribuidor_x6') - c.costo_landing_unitario_pen as utilidad_x6
from public.batch_model_costs c
join public.import_batches b on b.id = c.batch_id
join public.vehicle_models m on m.id = c.model_id
left join public.price_list pl on pl.batch_id = c.batch_id and pl.model_id = c.model_id
group by b.id, b.codigo_embarque, m.id, m.codigo_modelo, m.categoria, c.cantidad, c.costo_landing_unitario_pen;

-- Stock para tienda y taller: sin costos; los precios solo aparecen si el rol puede verlos
create view public.v_stock with (security_invoker = true) as
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
       v.batch_id, v.model_id, v.location_id
from public.vehicle_inventory v
join public.vehicle_models m on m.id = v.model_id
left join public.locations l on l.id = v.location_id
left join public.price_list pl on pl.batch_id = v.batch_id and pl.model_id = v.model_id
group by v.id, l.nombre, m.id;

-- Auditoría (3.2): packing list vs DAM vs unidades registradas / inspeccionadas
create view public.v_batch_reconciliation with (security_invoker = true) as
select b.id as batch_id, b.codigo_embarque, b.nro_dam, b.estado as estado_lote,
       m.codigo_modelo, m.voltaje_sistema, m.cantidad_baterias_12v,
       i.cantidad_packing_list,
       i.cantidad_dam,
       count(v.id)                                                  as unidades_registradas,
       count(v.id) filter (where bt.n = m.cantidad_baterias_12v)    as unidades_baterias_completas,
       count(v.id) filter (where ti.aprobada)                        as unidades_inspeccion_aprobada,
       (i.cantidad_dam is not null and i.cantidad_dam <> i.cantidad_packing_list) as alerta_packing_vs_dam,
       (count(v.id) <> i.cantidad_packing_list)                      as alerta_faltan_registrar,
       (count(v.id) filter (where coalesce(bt.n, 0) <> m.cantidad_baterias_12v) > 0) as alerta_baterias
from public.batch_items i
join public.import_batches b on b.id = i.batch_id
join public.vehicle_models m on m.id = i.model_id
left join public.vehicle_inventory v on v.batch_id = i.batch_id and v.model_id = i.model_id
left join lateral (select count(*)::int as n from public.vehicle_batteries x where x.vehicle_id = v.id) bt on true
left join lateral (select t.aprobada from public.technical_inspections t
                   where t.vehicle_id = v.id order by t.created_at desc limit 1) ti on true
group by b.id, m.id, i.id;

-- Margen real por venta confirmada (solo admin)
create view public.v_sales_margin with (security_invoker = true) as
select o.id as order_id, o.numero, o.confirmada_at, o.tipo_venta, o.cliente_nombre,
       v.vin_chasis, m.codigo_modelo,
       oi.precio_unitario_pen,
       c.costo_landing_unitario_pen,
       oi.precio_unitario_pen - c.costo_landing_unitario_pen as utilidad_pen,
       round((oi.precio_unitario_pen - c.costo_landing_unitario_pen) / nullif(oi.precio_unitario_pen, 0), 4) as margen_real
from public.sales_orders o
join public.order_items oi on oi.order_id = o.id and oi.activo
join public.vehicle_inventory v on v.id = oi.vehicle_id
join public.vehicle_models m on m.id = v.model_id
join public.batch_model_costs c on c.batch_id = v.batch_id and c.model_id = v.model_id
where o.estado = 'confirmada';

-- Estado de garantías
create view public.v_warranties with (security_invoker = true) as
select w.*, v.vin_chasis, m.codigo_modelo, o.numero as orden_numero, o.cliente_nombre, o.cliente_documento,
       (not w.anulada and public.fecha_lima() between w.fecha_inicio and w.fecha_fin) as vigente,
       greatest(w.fecha_fin - public.fecha_lima(), 0) as dias_restantes
from public.warranties w
join public.vehicle_inventory v on v.id = w.vehicle_id
join public.vehicle_models m on m.id = v.model_id
join public.sales_orders o on o.id = w.order_id;
