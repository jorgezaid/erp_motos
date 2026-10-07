-- =============================================================================
-- RN-04 al editar el packing list (tarea 5.3, D23)
-- RN-04 se validaba solo al registrar unidades. Si después se baja la cantidad del packing list
-- por debajo de las unidades ya registradas, el lote queda inconsistente: se impide.
-- (Quitar la línea con unidades ya lo impide la FK de vehicle_inventory.)
-- =============================================================================

create function public.guard_packing_cantidad() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_registradas int;
  v_codigo text;
begin
  select count(*) into v_registradas
  from public.vehicle_inventory v
  where v.batch_id = new.batch_id and v.model_id = new.model_id;

  if new.cantidad_packing_list < v_registradas then
    select m.codigo_modelo into v_codigo from public.vehicle_models m where m.id = new.model_id;
    raise exception 'El modelo % ya tiene % unidad(es) registradas en este lote: la cantidad del packing list no puede ser menor',
      v_codigo, v_registradas;
  end if;
  return new;
end $$;

create trigger trg_guard_packing_cantidad before update of cantidad_packing_list on public.batch_items
  for each row when (new.cantidad_packing_list < old.cantidad_packing_list)
  execute function public.guard_packing_cantidad();

-- El modelo de una línea no se cambia: se quita la línea y se agrega otra
create function public.guard_packing_modelo() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'No se puede cambiar el modelo de una línea del packing list: quítala y agrega otra';
end $$;

create trigger trg_guard_packing_modelo before update of model_id, batch_id on public.batch_items
  for each row when ((new.model_id, new.batch_id) is distinct from (old.model_id, old.batch_id))
  execute function public.guard_packing_modelo();
