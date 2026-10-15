-- =============================================================================
-- Escalas de venta activas (D31)
-- Cada escala (x1/x3/x6) se puede activar o desactivar. Por ahora el negocio solo vende por
-- unidad: x3 y x6 quedan desactivadas. Los márgenes NO cambian (el de x1 lo fija el admin
-- desde /precios).
--
-- - Una orden no se crea, no cambia de tipo de venta ni se confirma con una escala inactiva.
--   Anular o editar el contacto de una venta confirmada sigue permitido.
-- - generar_lista_precios no cambia: sigue generando las 3 escalas, así al reactivar una ya
--   tiene precios.
-- - Activar o desactivar una escala no regenera los precios de todos los lotes: el trigger
--   after_margins_changed pasa a dispararse solo con margen_objetivo o cantidad_minima.
-- - Debe quedar al menos una escala activa.
-- RLS: price_margins ya tiene sus políticas (staff lee, admin edita); la columna nueva las hereda.
-- =============================================================================

alter table public.price_margins add column activo boolean not null default true;

update public.price_margins set activo = false where tipo_venta in ('mayorista_x3', 'distribuidor_x6');

-- Nombre de la escala para los mensajes al usuario
create function public.nombre_escala(p_tipo public.sale_type) returns text
language sql immutable set search_path = '' as $$
  select case p_tipo
    when 'unidad_x1'       then 'por unidad (x1)'
    when 'mayorista_x3'    then 'mayorista (x3)'
    when 'distribuidor_x6' then 'distribuidor (x6)'
  end
$$;

-- Orden con escala inactiva: al crearla, al cambiar su tipo de venta y al confirmarla
create function public.guard_escala_activa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_activo  boolean;
  v_activas text;
begin
  if tg_op = 'UPDATE'
     and new.tipo_venta = old.tipo_venta
     and not (old.estado = 'borrador' and new.estado = 'confirmada') then
    return new;
  end if;

  select activo into v_activo from public.price_margins where tipo_venta = new.tipo_venta;
  if coalesce(v_activo, false) then
    return new;
  end if;

  select string_agg(public.nombre_escala(tipo_venta), ' o ' order by cantidad_minima)
    into v_activas
  from public.price_margins where activo;

  raise exception 'La venta % está desactivada; %.', public.nombre_escala(new.tipo_venta),
    coalesce('solo se puede vender ' || v_activas, 'no hay ninguna escala de venta activa');
end $$;

create trigger trg_guard_escala_activa before insert or update on public.sales_orders
  for each row execute function public.guard_escala_activa();

-- Al menos una escala activa
create function public.guard_alguna_escala_activa() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.price_margins where activo) then
    raise exception 'Debe quedar al menos una escala de venta activa';
  end if;
  return null;
end $$;

create trigger trg_guard_alguna_escala_activa after update of activo on public.price_margins
  for each statement execute function public.guard_alguna_escala_activa();

-- Activar o desactivar una escala no regenera los precios (solo margen o mínimo)
drop trigger trg_after_margins_changed on public.price_margins;
create trigger trg_after_margins_changed after update of margen_objetivo, cantidad_minima on public.price_margins
  for each statement execute function public.after_margins_changed();

revoke execute on function public.nombre_escala(public.sale_type) from public, anon;
revoke execute on function public.guard_escala_activa() from public, anon;
revoke execute on function public.guard_alguna_escala_activa() from public, anon;
