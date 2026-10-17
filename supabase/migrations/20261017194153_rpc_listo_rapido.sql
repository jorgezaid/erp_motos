-- =============================================================================
-- RPC listo_rapido (tarea 13.1, D37)
-- "Listo rápido" del taller: lleva una o varias motos a listo_en_tienda en UNA transacción,
-- con los MISMOS pasos que el flujo normal de /taller/[id] (nada se desactiva):
--   1. en_caja → en_ensamble (si ya está en ensamble, se salta; sus baterías se conservan)
--   2. baterías que falten hasta las que exige el voltaje (RN-01/RN-02 en guard_battery):
--      el serial escrito por el técnico o, si lo deja vacío, uno provisional único
--      «PROV-<VIN>-<posición>» (RN-03: los seriales son únicos)
--   3. inspección con todo el checklist marcado (RN-11: `aprobada` la calcula la columna
--      generada; `baterias_esperadas` la fija inspection_defaults). Queda marcada con
--      checklist.listo_rapido = true y la observación «Listo rápido». El voltaje medido queda
--      vacío: nadie lo midió.
--   4. en_ensamble → listo_en_tienda con la ubicación (RN-10 en guard_vehicle_update)
-- Todo o nada: si una moto falla, no se guarda ninguna, y el error dice su VIN.
--
-- El prefijo PROV- queda reservado a los seriales provisionales: un serial escrito que empiece
-- así se rechaza. Para reemplazarlos por los reales basta un UPDATE de vehicle_batteries.
--
-- p_unidades: [{ "vehicle_id": uuid, "seriales": [{ "posicion": 1..6, "serial": text }] }]
--   (`seriales` es opcional; solo para posiciones libres).
-- SECURITY INVOKER: corre con el RLS del usuario (admin o técnico) y respeta todos los triggers.
-- =============================================================================

create function public.listo_rapido(p_unidades jsonb, p_location_id uuid)
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
  if not public.has_role('admin', 'tecnico') then
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

comment on function public.listo_rapido(jsonb, uuid) is
  'D37: lleva motos en caja o en ensamble a listo_en_tienda (ensamble, baterías con seriales PROV- si faltan, inspección y tienda) todo o nada.';

revoke execute on function public.listo_rapido(jsonb, uuid) from public, anon;
