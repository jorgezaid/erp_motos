-- =============================================================================
-- Editar el color de una unidad (D39)
--   · RPC editar_color_unidad: solo cambia color_primario y color_secundario (no es un UPDATE
--     abierto). Admin y técnico; una moto vendida solo la corrige el admin.
--   · Los colores se guardan en MAYÚSCULAS, sin espacios sobrantes (normalizar_color), también
--     al registrar o importar unidades, y se normalizan los que ya existen.
--   · Quién y cuándo cambió el color: color_actualizado_por / color_actualizado_at.
--   · La política "admin/técnico actualizan" sigue permitiendo UPDATE directos (estado,
--     ubicación): el trigger guard_color_unidad aplica la misma regla de las vendidas y la
--     auditoría por cualquier vía.
-- =============================================================================

-- ---------------------------------------------------------------- normalización
-- '  rojo   oscuro ' → 'ROJO OSCURO'; vacío → NULL
create function public.normalizar_color(p text) returns text
language sql immutable set search_path = '' as $$
  select nullif(upper(btrim(regexp_replace(p, '\s+', ' ', 'g'))), '')
$$;

revoke execute on function public.normalizar_color(text) from public, anon;
grant execute on function public.normalizar_color(text) to authenticated, service_role;

-- ---------------------------------------------------------------- auditoría
alter table public.vehicle_inventory
  add column color_actualizado_por uuid references public.profiles (id),
  add column color_actualizado_at  timestamptz;

-- Colores existentes: antes del trigger, para que no cuenten como un cambio de nadie
update public.vehicle_inventory
set color_primario   = public.normalizar_color(color_primario),
    color_secundario = public.normalizar_color(color_secundario)
where (color_primario, color_secundario) is distinct from
      (public.normalizar_color(color_primario), public.normalizar_color(color_secundario));

-- ---------------------------------------------------------------- guard por cualquier vía
create function public.guard_color_unidad() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.color_primario   := public.normalizar_color(new.color_primario);
  new.color_secundario := public.normalizar_color(new.color_secundario);

  if tg_op = 'INSERT' then
    new.color_actualizado_por := null;
    new.color_actualizado_at  := null;
    return new;
  end if;

  if (new.color_primario, new.color_secundario) is distinct from (old.color_primario, old.color_secundario) then
    if old.estado = 'vendido' and not public.is_privileged() then
      raise exception 'Solo un administrador puede corregir el color de una moto vendida' using errcode = '42501';
    end if;
    new.color_actualizado_por := auth.uid();
    new.color_actualizado_at  := now();
  else
    -- La auditoría no se escribe a mano
    new.color_actualizado_por := old.color_actualizado_por;
    new.color_actualizado_at  := old.color_actualizado_at;
  end if;
  return new;
end $$;

revoke execute on function public.guard_color_unidad() from public, anon;
grant execute on function public.guard_color_unidad() to authenticated, service_role;

create trigger trg_color_unidad before insert or update on public.vehicle_inventory
  for each row execute function public.guard_color_unidad();

-- ---------------------------------------------------------------- RPC
-- SECURITY DEFINER: el UPDATE solo toca las columnas de color; los permisos se comprueban aquí.
create function public.editar_color_unidad(p_vehicle_id uuid, p_primario text, p_secundario text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v           public.vehicle_inventory;
  v_primario  text := public.normalizar_color(p_primario);
  v_secundario text := public.normalizar_color(p_secundario);
begin
  if not public.has_role('admin', 'tecnico') then
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

comment on function public.editar_color_unidad(uuid, text, text) is
  'D39: cambia solo los colores de una unidad (admin y técnico; vendida solo admin), normalizados a MAYÚSCULAS.';

revoke execute on function public.editar_color_unidad(uuid, text, text) from public, anon;
grant execute on function public.editar_color_unidad(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------- importador (D33)
-- Igual que en 20261015175924_rpc_importar_plantilla, salvo que compara los colores ya
-- normalizados: reimportar "Rojo" sobre "ROJO" no cuenta como un cambio.
create or replace function public.importar_plantilla(p_datos jsonb)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  l          jsonb := p_datos -> 'lote';
  r          jsonb;
  v_hoja     text := 'Lote';
  v_fila     int;
  v_loc      public.locations;
  m          public.vehicle_models;
  m_nuevo    public.vehicle_models;
  b          public.import_batches;
  b_nuevo    public.import_batches;
  i          public.batch_items;
  i_nuevo    public.batch_items;
  v          public.vehicle_inventory;
  v_nuevo    public.vehicle_inventory;
  v_bat      public.vehicle_batteries;
  v_lote_creado      boolean := false;
  v_lote_actualizado boolean := false;
  n_ubi_c int := 0; n_ubi_a int := 0;
  n_mod_c int := 0; n_mod_a int := 0;
  n_pl_c  int := 0; n_pl_a  int := 0;
  n_uni_c int := 0; n_uni_a int := 0;
  n_bat_c int := 0;
  v_restriccion text;
  v_columna     text;
  v_mensaje     text;
begin
  if not public.has_role('admin') then
    raise exception 'Solo un administrador puede importar la plantilla' using errcode = '42501';
  end if;
  if jsonb_typeof(l) is distinct from 'object' or coalesce(trim(l ->> 'codigo_embarque'), '') = '' then
    raise exception 'Hoja «Lote»: falta el código de embarque';
  end if;

  begin
    -- ------------------------------------------------------------ 1. Ubicaciones (por nombre)
    v_hoja := 'Ubicaciones';
    for r in select * from jsonb_array_elements(coalesce(p_datos -> 'ubicaciones', '[]'::jsonb)) loop
      v_fila := (r ->> 'fila')::int;
      select * into v_loc from public.locations where lower(nombre) = lower(trim(r ->> 'nombre')) for update;
      if not found then
        insert into public.locations (nombre, tipo, direccion)
        values (trim(r ->> 'nombre'), (r ->> 'tipo')::public.location_type, r ->> 'direccion');
        n_ubi_c := n_ubi_c + 1;
      elsif (v_loc.nombre, v_loc.tipo, v_loc.direccion) is distinct from
            (trim(r ->> 'nombre'), (r ->> 'tipo')::public.location_type, coalesce(r ->> 'direccion', v_loc.direccion)) then
        update public.locations
        set nombre = trim(r ->> 'nombre'), tipo = (r ->> 'tipo')::public.location_type,
            direccion = coalesce(r ->> 'direccion', direccion)
        where id = v_loc.id;
        if not found then raise exception 'No tiene permiso para modificar la ubicación %', v_loc.nombre; end if;
        n_ubi_a := n_ubi_a + 1;
      end if;
    end loop;

    -- ------------------------------------------------------------ 2. Modelos (por código)
    v_hoja := 'Modelos';
    for r in select * from jsonb_array_elements(coalesce(p_datos -> 'modelos', '[]'::jsonb)) loop
      v_fila := (r ->> 'fila')::int;
      select * into m from public.vehicle_models
      where upper(codigo_modelo) = upper(trim(r ->> 'codigo_modelo')) for update;
      if not found then
        insert into public.vehicle_models (codigo_modelo, nombre_comercial, categoria, voltaje_sistema,
                                           amperaje_bateria_ah, potencia_motor_watts, volumen_cbm_unitario,
                                           exw_usd_unitario, garantia_meses, garantia_baterias_meses)
        values (upper(trim(r ->> 'codigo_modelo')), r ->> 'nombre_comercial', (r ->> 'categoria')::public.vehicle_category,
                (r ->> 'voltaje_sistema')::int, (r ->> 'amperaje_bateria_ah')::int, (r ->> 'potencia_motor_watts')::int,
                (r ->> 'volumen_cbm_unitario')::numeric, (r ->> 'exw_usd_unitario')::numeric,
                coalesce((r ->> 'garantia_meses')::int, 12), coalesce((r ->> 'garantia_baterias_meses')::int, 6));
        n_mod_c := n_mod_c + 1;
      else
        m_nuevo := m;
        m_nuevo.nombre_comercial        := coalesce(r ->> 'nombre_comercial', m.nombre_comercial);
        m_nuevo.categoria               := coalesce((r ->> 'categoria')::public.vehicle_category, m.categoria);
        m_nuevo.voltaje_sistema         := coalesce((r ->> 'voltaje_sistema')::int, m.voltaje_sistema);
        m_nuevo.amperaje_bateria_ah     := coalesce((r ->> 'amperaje_bateria_ah')::int, m.amperaje_bateria_ah);
        m_nuevo.potencia_motor_watts    := coalesce((r ->> 'potencia_motor_watts')::int, m.potencia_motor_watts);
        m_nuevo.volumen_cbm_unitario    := coalesce((r ->> 'volumen_cbm_unitario')::numeric, m.volumen_cbm_unitario);
        m_nuevo.exw_usd_unitario        := coalesce((r ->> 'exw_usd_unitario')::numeric, m.exw_usd_unitario);
        m_nuevo.garantia_meses          := coalesce((r ->> 'garantia_meses')::int, m.garantia_meses);
        m_nuevo.garantia_baterias_meses := coalesce((r ->> 'garantia_baterias_meses')::int, m.garantia_baterias_meses);
        if m_nuevo is distinct from m then
          update public.vehicle_models
          set nombre_comercial = m_nuevo.nombre_comercial, categoria = m_nuevo.categoria,
              voltaje_sistema = m_nuevo.voltaje_sistema, amperaje_bateria_ah = m_nuevo.amperaje_bateria_ah,
              potencia_motor_watts = m_nuevo.potencia_motor_watts, volumen_cbm_unitario = m_nuevo.volumen_cbm_unitario,
              exw_usd_unitario = m_nuevo.exw_usd_unitario, garantia_meses = m_nuevo.garantia_meses,
              garantia_baterias_meses = m_nuevo.garantia_baterias_meses
          where id = m.id;
          if not found then raise exception 'No tiene permiso para modificar el modelo %', m.codigo_modelo; end if;
          n_mod_a := n_mod_a + 1;
        end if;
      end if;
    end loop;

    -- ------------------------------------------------------------ 3. Lote (por código de embarque)
    v_hoja := 'Lote';
    v_fila := null;
    select * into b from public.import_batches where codigo_embarque = trim(l ->> 'codigo_embarque') for update;
    if not found then
      insert into public.import_batches (codigo_embarque) values (trim(l ->> 'codigo_embarque')) returning * into b;
      v_lote_creado := true;
    elsif b.estado = 'liquidado' then
      raise exception 'El lote % está liquidado: reábralo en su pestaña Costeo antes de importar', b.codigo_embarque;
    end if;
    b_nuevo := b;
    b_nuevo.nro_dam                   := coalesce(l ->> 'nro_dam', b.nro_dam);
    b_nuevo.proveedor                 := coalesce(l ->> 'proveedor', b.proveedor);
    b_nuevo.fecha_embarque            := coalesce((l ->> 'fecha_embarque')::date, b.fecha_embarque);
    b_nuevo.fecha_llegada             := coalesce((l ->> 'fecha_llegada')::date, b.fecha_llegada);
    b_nuevo.tipo_cambio               := coalesce((l ->> 'tipo_cambio')::numeric, b.tipo_cambio);
    b_nuevo.fob_total_usd             := coalesce((l ->> 'fob_total_usd')::numeric, b.fob_total_usd);
    b_nuevo.flete_internacional_usd   := coalesce((l ->> 'flete_internacional_usd')::numeric, b.flete_internacional_usd);
    b_nuevo.gastos_agente_usd         := coalesce((l ->> 'gastos_agente_usd')::numeric, b.gastos_agente_usd);
    b_nuevo.ad_valorem_pen            := coalesce((l ->> 'ad_valorem_pen')::numeric, b.ad_valorem_pen);
    b_nuevo.igv_pen                   := coalesce((l ->> 'igv_pen')::numeric, b.igv_pen);
    b_nuevo.ipm_pen                   := coalesce((l ->> 'ipm_pen')::numeric, b.ipm_pen);
    b_nuevo.percepcion_pen            := coalesce((l ->> 'percepcion_pen')::numeric, b.percepcion_pen);
    b_nuevo.flete_nacional_pen        := coalesce((l ->> 'flete_nacional_pen')::numeric, b.flete_nacional_pen);
    b_nuevo.alquiler_periodo_pen      := coalesce((l ->> 'alquiler_periodo_pen')::numeric, b.alquiler_periodo_pen);
    b_nuevo.sueldos_periodo_pen       := coalesce((l ->> 'sueldos_periodo_pen')::numeric, b.sueldos_periodo_pen);
    b_nuevo.publicidad_inicial_pen    := coalesce((l ->> 'publicidad_inicial_pen')::numeric, b.publicidad_inicial_pen);
    b_nuevo.costo_armado_unitario_pen := coalesce((l ->> 'costo_armado_unitario_pen')::numeric, b.costo_armado_unitario_pen);
    if b_nuevo is distinct from b then
      update public.import_batches
      set nro_dam = b_nuevo.nro_dam, proveedor = b_nuevo.proveedor,
          fecha_embarque = b_nuevo.fecha_embarque, fecha_llegada = b_nuevo.fecha_llegada,
          tipo_cambio = b_nuevo.tipo_cambio, fob_total_usd = b_nuevo.fob_total_usd,
          flete_internacional_usd = b_nuevo.flete_internacional_usd, gastos_agente_usd = b_nuevo.gastos_agente_usd,
          ad_valorem_pen = b_nuevo.ad_valorem_pen, igv_pen = b_nuevo.igv_pen, ipm_pen = b_nuevo.ipm_pen,
          percepcion_pen = b_nuevo.percepcion_pen, flete_nacional_pen = b_nuevo.flete_nacional_pen,
          alquiler_periodo_pen = b_nuevo.alquiler_periodo_pen, sueldos_periodo_pen = b_nuevo.sueldos_periodo_pen,
          publicidad_inicial_pen = b_nuevo.publicidad_inicial_pen,
          costo_armado_unitario_pen = b_nuevo.costo_armado_unitario_pen
      where id = b.id;
      if not found then raise exception 'No tiene permiso para modificar el lote %', b.codigo_embarque; end if;
      v_lote_actualizado := not v_lote_creado;
    end if;

    -- ------------------------------------------------------------ 4. Packing list (por modelo)
    v_hoja := 'Packing list';
    for r in select * from jsonb_array_elements(coalesce(p_datos -> 'packing', '[]'::jsonb)) loop
      v_fila := (r ->> 'fila')::int;
      select * into m from public.vehicle_models where upper(codigo_modelo) = upper(trim(r ->> 'codigo_modelo'));
      if not found then raise exception 'El modelo % no existe', r ->> 'codigo_modelo'; end if;
      select * into i from public.batch_items where batch_id = b.id and model_id = m.id for update;
      if not found then
        insert into public.batch_items (batch_id, model_id, cantidad_packing_list, cantidad_dam,
                                        exw_usd_unitario, volumen_cbm_unitario)
        values (b.id, m.id, (r ->> 'cantidad_packing_list')::int, (r ->> 'cantidad_dam')::int,
                coalesce((r ->> 'exw_usd_unitario')::numeric, m.exw_usd_unitario), m.volumen_cbm_unitario);
        n_pl_c := n_pl_c + 1;
      else
        i_nuevo := i;
        i_nuevo.cantidad_packing_list := (r ->> 'cantidad_packing_list')::int;
        i_nuevo.cantidad_dam          := coalesce((r ->> 'cantidad_dam')::int, i.cantidad_dam);
        i_nuevo.exw_usd_unitario      := coalesce((r ->> 'exw_usd_unitario')::numeric, m.exw_usd_unitario);
        i_nuevo.volumen_cbm_unitario  := m.volumen_cbm_unitario;
        if i_nuevo is distinct from i then
          update public.batch_items
          set cantidad_packing_list = i_nuevo.cantidad_packing_list, cantidad_dam = i_nuevo.cantidad_dam,
              exw_usd_unitario = i_nuevo.exw_usd_unitario, volumen_cbm_unitario = i_nuevo.volumen_cbm_unitario
          where id = i.id;
          if not found then raise exception 'No tiene permiso para modificar el packing list'; end if;
          n_pl_a := n_pl_a + 1;
        end if;
      end if;
    end loop;

    -- ------------------------------------------------------------ 5. Unidades (por VIN, en caja)
    v_hoja := 'Unidades';
    for r in select * from jsonb_array_elements(coalesce(p_datos -> 'unidades', '[]'::jsonb)) loop
      v_fila := (r ->> 'fila')::int;
      select * into m from public.vehicle_models where upper(codigo_modelo) = upper(trim(r ->> 'codigo_modelo'));
      if not found then raise exception 'El modelo % no existe', r ->> 'codigo_modelo'; end if;
      select * into v from public.vehicle_inventory where vin_chasis = r ->> 'vin_chasis' for update;
      if not found then
        insert into public.vehicle_inventory (batch_id, model_id, vin_chasis, nro_motor, color_primario,
                                              color_secundario, notas, estado)
        values (b.id, m.id, r ->> 'vin_chasis', r ->> 'nro_motor', r ->> 'color_primario',
                r ->> 'color_secundario', r ->> 'notas', 'en_caja');
        n_uni_c := n_uni_c + 1;
      elsif v.batch_id <> b.id or v.model_id <> m.id then
        raise exception 'El VIN % ya está registrado en otro lote o con otro modelo', v.vin_chasis;
      else
        v_nuevo := v;
        v_nuevo.nro_motor        := r ->> 'nro_motor';
        v_nuevo.color_primario   := coalesce(public.normalizar_color(r ->> 'color_primario'), v.color_primario);
        v_nuevo.color_secundario := coalesce(public.normalizar_color(r ->> 'color_secundario'), v.color_secundario);
        v_nuevo.notas            := coalesce(r ->> 'notas', v.notas);
        if v_nuevo is distinct from v then
          update public.vehicle_inventory
          set nro_motor = v_nuevo.nro_motor, color_primario = v_nuevo.color_primario,
              color_secundario = v_nuevo.color_secundario, notas = v_nuevo.notas
          where id = v.id;
          if not found then raise exception 'No tiene permiso para modificar la unidad %', v.vin_chasis; end if;
          n_uni_a := n_uni_a + 1;
        end if;
      end if;
    end loop;

    -- ------------------------------------------------------------ 6. Baterías (por serial)
    v_hoja := 'Baterías (opcional)';
    for r in select * from jsonb_array_elements(coalesce(p_datos -> 'baterias', '[]'::jsonb)) loop
      v_fila := (r ->> 'fila')::int;
      select * into v from public.vehicle_inventory where vin_chasis = r ->> 'vin_chasis';
      if not found or v.batch_id <> b.id then
        raise exception 'La unidad % no está en el lote %', r ->> 'vin_chasis', b.codigo_embarque;
      end if;
      select * into v_bat from public.vehicle_batteries where serial = upper(trim(r ->> 'serial'));
      if found then
        if v_bat.vehicle_id <> v.id then
          raise exception 'El serial de batería % ya está registrado en otra unidad', v_bat.serial;
        end if;
        -- ya registrado en esta unidad: no se toca
      else
        insert into public.vehicle_batteries (vehicle_id, serial, posicion)
        values (v.id, upper(trim(r ->> 'serial')), (r ->> 'posicion')::smallint);
        n_bat_c := n_bat_c + 1;
      end if;
    end loop;

  exception when others then
    get stacked diagnostics v_restriccion = constraint_name, v_columna = column_name;
    v_mensaje := case sqlstate
      when '23505' then case
        when v_restriccion like '%vin_chasis%'    then 'El VIN ya está registrado'
        when v_restriccion like '%nro_motor%'     then 'El número de motor ya está registrado en otra unidad'
        when v_restriccion like '%posicion%'      then 'Esa posición de batería ya tiene otro serial'
        when v_restriccion like '%serial%'        then 'El serial de batería ya está registrado'
        when v_restriccion like '%nro_dam%'       then 'El número de DAM ya está registrado en otro lote'
        when v_restriccion like '%codigo_modelo%' then 'El código de modelo ya está registrado'
        when v_restriccion like '%nombre%'        then 'Ya existe una ubicación con ese nombre'
        else 'Hay un valor repetido que ya existe en el sistema' end
      when '23514' then case
        when v_restriccion = 'vehicle_models_voltaje_sistema_check' then 'El voltaje debe ser 48V, 60V o 72V'
        else format('Un valor no cumple las reglas del sistema (%s)', v_restriccion) end
      when '23502' then format('Falta un dato obligatorio (%s)', v_columna)
      when '22P02' then 'Un valor no tiene el formato esperado'
      when '22007' then 'Una fecha no es válida'
      when '22008' then 'Una fecha no es válida'
      when '22003' then 'Un número es demasiado grande'
      else sqlerrm end;
    if v_fila is null then
      v_mensaje := format('Hoja «%s»: %s', v_hoja, v_mensaje);
    else
      v_mensaje := format('Hoja «%s», fila %s: %s', v_hoja, v_fila, v_mensaje);
    end if;
    raise exception '%', v_mensaje using errcode = case when sqlstate = '42501' then '42501' else 'P0001' end;
  end;

  return jsonb_build_object(
    'lote', jsonb_build_object('id', b.id, 'codigo_embarque', b.codigo_embarque,
                               'creado', v_lote_creado, 'actualizado', v_lote_actualizado),
    'ubicaciones', jsonb_build_object('creadas', n_ubi_c, 'actualizadas', n_ubi_a),
    'modelos',     jsonb_build_object('creados', n_mod_c, 'actualizados', n_mod_a),
    'packing',     jsonb_build_object('creadas', n_pl_c, 'actualizadas', n_pl_a),
    'unidades',    jsonb_build_object('creadas', n_uni_c, 'actualizadas', n_uni_a),
    'baterias',    jsonb_build_object('creadas', n_bat_c));
end $$;
