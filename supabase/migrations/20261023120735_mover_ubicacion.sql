-- =============================================================================
-- Mover motos de ubicación (D40)
--   · RPC mover_unidades: solo cambia location_id (no es un UPDATE abierto). Admin y técnico;
--     varias motos a la vez, todas o ninguna. Una moto vendida no se mueve.
--   · Historial de movimientos (moto, desde, hacia, quién y cuándo) en movimientos_ubicacion,
--     que llena un trigger con cualquier cambio de ubicación (RPC, «Pasar a tienda», «Listo
--     rápido» o un UPDATE directo).
--   · guard_ubicacion_unidad: por cualquier vía, una moto vendida no cambia de ubicación y una
--     moto en tienda no queda sin ubicación.
-- =============================================================================

-- ---------------------------------------------------------------- historial
create table public.movimientos_ubicacion (
  id                 bigint generated always as identity primary key,
  vehicle_id         uuid not null references public.vehicle_inventory (id) on delete cascade,
  desde_location_id  uuid references public.locations (id),
  hacia_location_id  uuid references public.locations (id),
  movido_por         uuid references public.profiles (id),
  movido_at          timestamptz not null default now()
);

create index on public.movimientos_ubicacion (vehicle_id, movido_at desc);

alter table public.movimientos_ubicacion enable row level security;

-- Solo lectura para admin y técnico; lo escribe únicamente el trigger (security definer)
create policy "admin/técnico leen movimientos" on public.movimientos_ubicacion for select to authenticated
  using ((select public.has_role('admin', 'tecnico')));

revoke all on public.movimientos_ubicacion from anon;
revoke all on sequence public.movimientos_ubicacion_id_seq from anon;

create function public.log_movimiento_ubicacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.location_id is not null then
      insert into public.movimientos_ubicacion (vehicle_id, desde_location_id, hacia_location_id, movido_por)
      values (new.id, null, new.location_id, auth.uid());
    end if;
  elsif new.location_id is distinct from old.location_id then
    insert into public.movimientos_ubicacion (vehicle_id, desde_location_id, hacia_location_id, movido_por)
    values (new.id, old.location_id, new.location_id, auth.uid());
  end if;
  return null;
end $$;

revoke execute on function public.log_movimiento_ubicacion() from public, anon;
grant execute on function public.log_movimiento_ubicacion() to authenticated, service_role;

create trigger trg_movimiento_ubicacion after insert or update of location_id on public.vehicle_inventory
  for each row execute function public.log_movimiento_ubicacion();

-- ---------------------------------------------------------------- guard por cualquier vía
create function public.guard_ubicacion_unidad() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.location_id is not distinct from old.location_id and new.estado = old.estado then
    return new;
  end if;
  if old.estado = 'vendido' and new.location_id is distinct from old.location_id then
    raise exception 'La moto % ya está vendida: no se puede mover', old.vin_chasis;
  end if;
  -- Solo cuando cambia algo: no bloquea otras ediciones de datos antiguos sin ubicación
  if new.estado = 'listo_en_tienda' and new.location_id is null then
    raise exception 'La moto % está en tienda: debe tener una ubicación', old.vin_chasis;
  end if;
  return new;
end $$;

revoke execute on function public.guard_ubicacion_unidad() from public, anon;
grant execute on function public.guard_ubicacion_unidad() to authenticated, service_role;

-- El nombre lo ordena después de trg_guard_vehicle_update: sus mensajes (transición, baterías,
-- inspección) son más precisos y deben salir primero
create trigger trg_ubicacion_unidad before update on public.vehicle_inventory
  for each row execute function public.guard_ubicacion_unidad();

-- ---------------------------------------------------------------- RPC
-- SECURITY DEFINER: el UPDATE solo toca location_id; los permisos se comprueban aquí.
-- Devuelve cuántas motos cambiaron de ubicación (las que ya estaban allí no cuentan).
create function public.mover_unidades(p_vehicle_ids uuid[], p_location_id uuid)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_ids   uuid[] := array(select distinct x from unnest(p_vehicle_ids) x);
  v_vin   text;
  v_n     int;
begin
  if not public.has_role('admin', 'tecnico') then
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

comment on function public.mover_unidades(uuid[], uuid) is
  'D40: cambia solo la ubicación de una o varias motos (admin y técnico; todas o ninguna; vendidas no).';

revoke execute on function public.mover_unidades(uuid[], uuid) from public, anon;
grant execute on function public.mover_unidades(uuid[], uuid) to authenticated, service_role;
