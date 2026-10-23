-- =============================================================================
-- Proveedores (D41, tarea 17.1)
--   · Tabla proveedores (nombre, RUC, teléfono) solo para admin: son datos de compras.
--   · import_batches.proveedor_id. El texto `proveedor` queda como dato histórico: la app ya no
--     lo escribe; si lo escribe el importador (D33), un trigger busca o crea el proveedor por
--     nombre y llena proveedor_id.
--   · Lote liquidado: guard_batch_update permite cambiar SOLO proveedor_id (no es un costo).
--   · Se crea «Tianjin Newspeed Cycle Co., Ltd.» y se enlazan los lotes existentes por nombre.
--   · Protección: foto de todos los lotes, sus costeos y price_list antes y después; si cambia
--     algo (salvo proveedor_id y updated_at), la migración aborta.
-- =============================================================================

-- ---------------------------------------------------------------- foto inicial
create temp table _foto_lotes as
select id, to_jsonb(b) - array['updated_at'] as fila from public.import_batches b;
create temp table _foto_costos as
select batch_id, model_id, to_jsonb(c) as fila from public.batch_model_costs c;
create temp table _foto_precios as
select batch_id, model_id, tipo_venta, to_jsonb(p) - array['updated_at'] as fila from public.price_list p;

-- ---------------------------------------------------------------- tabla
create table public.proveedores (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (length(btrim(nombre)) between 1 and 120),
  ruc         text check (ruc ~ '^\d{11}$'),
  telefono    text check (length(telefono) <= 30),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index proveedores_nombre_key on public.proveedores (lower(btrim(nombre)));
create unique index proveedores_ruc_key on public.proveedores (ruc) where ruc is not null;

alter table public.proveedores enable row level security;

create policy "admin gestiona proveedores" on public.proveedores for all to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));

revoke all on public.proveedores from anon;

create trigger trg_proveedores_updated_at before update on public.proveedores
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- lote → proveedor
alter table public.import_batches add column proveedor_id uuid references public.proveedores (id);
create index on public.import_batches (proveedor_id);

-- El importador (D33) escribe el texto: se busca el proveedor por nombre o se crea
create function public.resolver_proveedor_lote() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_nombre text := nullif(btrim(new.proveedor), '');
begin
  if v_nombre is null or (tg_op = 'UPDATE' and new.proveedor is not distinct from old.proveedor) then
    return new;
  end if;
  select id into new.proveedor_id from public.proveedores where lower(btrim(nombre)) = lower(v_nombre);
  if not found then
    insert into public.proveedores (nombre) values (v_nombre) returning id into new.proveedor_id;
  end if;
  return new;
end $$;

revoke execute on function public.resolver_proveedor_lote() from public, anon;
grant execute on function public.resolver_proveedor_lote() to authenticated, service_role;

create trigger trg_resolver_proveedor_lote before insert or update of proveedor on public.import_batches
  for each row execute function public.resolver_proveedor_lote();

-- ---------------------------------------------------------------- guard del lote liquidado
-- Igual que en 20260925000200_reglas_negocio, salvo que un lote liquidado admite cambiar
-- proveedor_id (además de las notas). Ninguna otra columna.
create or replace function public.guard_batch_update() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_faltantes int;
begin
  -- a) Lote liquidado y sigue liquidado: solo se pueden editar notas y proveedor_id
  if old.estado = 'liquidado' and new.estado = 'liquidado' then
    -- (las columnas generadas llegan nulas a un trigger BEFORE: se excluyen)
    if (to_jsonb(new) - array['notas', 'proveedor_id', 'updated_at', 'impuestos_sunat_pen',
                              'impuestos_asignables_pen', 'gastos_operativos_fijos_pen'])
       is distinct from
       (to_jsonb(old) - array['notas', 'proveedor_id', 'updated_at', 'impuestos_sunat_pen',
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

-- ---------------------------------------------------------------- datos iniciales
insert into public.proveedores (nombre)
select 'Tianjin Newspeed Cycle Co., Ltd.'
where not exists (select 1 from public.proveedores where lower(nombre) like 'tianjin newspeed%');

insert into public.proveedores (nombre)
select distinct on (lower(btrim(b.proveedor))) btrim(b.proveedor)
from public.import_batches b
where nullif(btrim(b.proveedor), '') is not null
  and not exists (select 1 from public.proveedores p where lower(btrim(p.nombre)) = lower(btrim(b.proveedor)));

update public.import_batches b
set proveedor_id = p.id
from public.proveedores p
where lower(btrim(p.nombre)) = lower(btrim(b.proveedor)) and b.proveedor_id is null;

-- ---------------------------------------------------------------- comprobación
do $$
declare
  v_lotes int; v_costos int; v_precios int;
begin
  select count(*) into v_lotes from (
    (select id, fila from _foto_lotes
     except select id, to_jsonb(b) - array['updated_at', 'proveedor_id'] from public.import_batches b)
    union all
    (select id, to_jsonb(b) - array['updated_at', 'proveedor_id'] from public.import_batches b
     except select id, fila from _foto_lotes)) x;
  select count(*) into v_costos from (
    (select batch_id, model_id, fila from _foto_costos
     except select batch_id, model_id, to_jsonb(c) from public.batch_model_costs c)
    union all
    (select batch_id, model_id, to_jsonb(c) from public.batch_model_costs c
     except select batch_id, model_id, fila from _foto_costos)) x;
  select count(*) into v_precios from (
    (select batch_id, model_id, tipo_venta, fila from _foto_precios
     except select batch_id, model_id, tipo_venta, to_jsonb(p) - array['updated_at'] from public.price_list p)
    union all
    (select batch_id, model_id, tipo_venta, to_jsonb(p) - array['updated_at'] from public.price_list p
     except select batch_id, model_id, tipo_venta, fila from _foto_precios)) x;
  if v_lotes + v_costos + v_precios > 0 then
    raise exception 'Migración proveedores abortada: cambiarían % lote(s), % costeo(s) y % precio(s)',
      v_lotes, v_costos, v_precios;
  end if;
end $$;

drop table _foto_lotes, _foto_costos, _foto_precios;
