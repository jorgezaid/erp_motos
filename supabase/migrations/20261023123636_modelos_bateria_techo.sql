-- =============================================================================
-- Modelos: compras locales, techo y batería de litio (D41, tarea 17.2)
--   · EXW (US$) y CBM dejan de ser obligatorios en el catálogo y en la línea del lote; en la
--     línea de un lote de importación siguen siendo obligatorios (trigger guard_linea_lote).
--   · tiene_techo (sí/no): atributo, no categoría (la moto con techo es una trimoto).
--   · tipo_bateria: plomo_12v (por defecto: los modelos actuales) o litio con su cantidad.
--     cantidad_baterias_12v conserva el nombre (lo usan triggers, vistas y la app) y pasa a ser
--     «baterías esperadas»: plomo → voltaje / 12; litio → baterias_litio.
--   · Sin SET EXPRESSION (PostgreSQL 17): la columna generada pasa a normal con DROP EXPRESSION
--     (PG ≥ 13, conserva los valores), la llena un trigger y un CHECK exige la fórmula, así que
--     sigue siendo imposible guardar una cantidad inconsistente (D5).
--   · No se cambia la cantidad esperada de un modelo con baterías ya registradas.
--   · Protección: foto de todos los lotes, costeos, price_list y la cantidad de baterías de cada
--     modelo antes y después; si cambia algo, la migración aborta.
-- =============================================================================

create temp table _foto_lotes as select id, to_jsonb(b) - array['updated_at'] as fila from public.import_batches b;
create temp table _foto_items as select id, to_jsonb(i) as fila from public.batch_items i;
create temp table _foto_costos as select batch_id, model_id, to_jsonb(c) as fila from public.batch_model_costs c;
create temp table _foto_precios as
  select batch_id, model_id, tipo_venta, to_jsonb(p) - array['updated_at'] as fila from public.price_list p;
create temp table _foto_modelos as
  select id, voltaje_sistema, cantidad_baterias_12v, exw_usd_unitario, volumen_cbm_unitario from public.vehicle_models;

-- ---------------------------------------------------------------- EXW y CBM opcionales
alter table public.vehicle_models alter column exw_usd_unitario drop not null;
alter table public.vehicle_models alter column volumen_cbm_unitario drop not null;
alter table public.batch_items alter column exw_usd_unitario drop not null;
alter table public.batch_items alter column volumen_cbm_unitario drop not null;

-- La línea de un lote de importación necesita EXW y CBM para el prorrateo (SPEC §7)
create function public.guard_linea_lote() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_codigo text;
begin
  if new.exw_usd_unitario is null or new.volumen_cbm_unitario is null then
    select codigo_modelo into v_codigo from public.vehicle_models where id = new.model_id;
    raise exception 'El modelo % no tiene EXW/CBM: indícalos en la línea', v_codigo;
  end if;
  return new;
end $$;

revoke execute on function public.guard_linea_lote() from public, anon;
grant execute on function public.guard_linea_lote() to authenticated, service_role;

create trigger trg_guard_linea_lote before insert or update on public.batch_items
  for each row execute function public.guard_linea_lote();

-- ---------------------------------------------------------------- techo
alter table public.vehicle_models add column tiene_techo boolean not null default false;

-- ---------------------------------------------------------------- tipo de batería
create type public.tipo_bateria as enum ('plomo_12v', 'litio');

alter table public.vehicle_models
  add column tipo_bateria   public.tipo_bateria not null default 'plomo_12v',
  add column baterias_litio int check (baterias_litio between 1 and 6),
  add constraint vehicle_models_tipo_bateria_check
    check ((tipo_bateria = 'litio') = (baterias_litio is not null));

-- La columna generada pasa a normal: conserva los valores actuales (voltaje / 12)
alter table public.vehicle_models alter column cantidad_baterias_12v drop expression;

create function public.baterias_esperadas_modelo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.tipo_bateria = 'litio' and new.baterias_litio is null then
    raise exception 'Indica cuántas baterías de litio lleva el modelo %', new.codigo_modelo;
  end if;
  new.cantidad_baterias_12v := case new.tipo_bateria
                                 when 'litio' then new.baterias_litio
                                 else new.voltaje_sistema / 12 end;
  -- Con un voltaje no válido responde el CHECK de la tabla (su mensaje es más claro)
  if tg_op = 'UPDATE' and new.cantidad_baterias_12v is distinct from old.cantidad_baterias_12v
     and new.voltaje_sistema in (48, 60, 72)
     and exists (select 1 from public.vehicle_batteries b
                 join public.vehicle_inventory v on v.id = b.vehicle_id
                 where v.model_id = new.id) then
    raise exception 'El modelo % ya tiene baterías registradas: no se puede cambiar el tipo, la cantidad de baterías ni el voltaje',
      old.codigo_modelo;
  end if;
  return new;
end $$;

revoke execute on function public.baterias_esperadas_modelo() from public, anon;
grant execute on function public.baterias_esperadas_modelo() to authenticated, service_role;

create trigger trg_baterias_esperadas_modelo before insert or update on public.vehicle_models
  for each row execute function public.baterias_esperadas_modelo();

alter table public.vehicle_models alter column cantidad_baterias_12v set not null;
alter table public.vehicle_models add constraint vehicle_models_cantidad_baterias_check
  check (cantidad_baterias_12v = case tipo_bateria when 'litio' then baterias_litio else voltaje_sistema / 12 end);

comment on column public.vehicle_models.cantidad_baterias_12v is
  'Baterías esperadas por unidad (D41): plomo 12V = voltaje / 12; litio = baterias_litio. La llena un trigger.';

-- ---------------------------------------------------------------- comprobación
do $$
declare
  v_cambios int;
begin
  select count(*) into v_cambios from (
    (select id, fila from _foto_lotes except select id, to_jsonb(b) - array['updated_at'] from public.import_batches b)
    union all
    (select id, to_jsonb(b) - array['updated_at'] from public.import_batches b except select id, fila from _foto_lotes)
    union all
    (select id, fila from _foto_items except select id, to_jsonb(i) from public.batch_items i)
    union all
    (select id, to_jsonb(i) from public.batch_items i except select id, fila from _foto_items)
    union all
    (select batch_id, fila from _foto_costos
     except select batch_id, to_jsonb(c) from public.batch_model_costs c)
    union all
    (select batch_id, to_jsonb(c) from public.batch_model_costs c
     except select batch_id, fila from _foto_costos)
    union all
    (select batch_id, fila from _foto_precios
     except select batch_id, to_jsonb(p) - array['updated_at'] from public.price_list p)
    union all
    (select batch_id, to_jsonb(p) - array['updated_at'] from public.price_list p
     except select batch_id, fila from _foto_precios)) x;
  select v_cambios + count(*) into v_cambios from (
    (select * from _foto_modelos
     except select id, voltaje_sistema, cantidad_baterias_12v, exw_usd_unitario, volumen_cbm_unitario from public.vehicle_models)
    union all
    (select id, voltaje_sistema, cantidad_baterias_12v, exw_usd_unitario, volumen_cbm_unitario from public.vehicle_models
     except select * from _foto_modelos)) y;
  if v_cambios > 0 then
    raise exception 'Migración modelos_bateria_techo abortada: cambiarían % fila(s) de lotes, costeos, precios o modelos', v_cambios;
  end if;
end $$;

drop table _foto_lotes, _foto_items, _foto_costos, _foto_precios, _foto_modelos;
