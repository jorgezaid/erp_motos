-- =============================================================================
-- Gastos del negocio y utilidad neta del mes (M9, D32 — opción A pura)
--
-- - RN-21: monto > 0; un gasto planificado tiene fecha estimada y no fecha de pago; uno
--   realizado tiene fecha de pago y método de pago.
-- - RN-22: los gastos son del negocio y NUNCA tocan el costo de las motos: la tabla no tiene
--   vínculo con lotes y ningún trigger de gastos escribe en import_batches, batch_model_costs
--   ni price_list (tests/test_gastos.sql lo comprueba).
-- - RN-23: v_utilidad_mensual = ventas confirmadas − costo landing de lo vendido
--   (v_sales_margin) − todos los gastos realizados del mes de Lima.
-- - RN-24: solo admin, en la tabla (RLS) y en el bucket privado `comprobantes-gastos`.
-- =============================================================================

create type public.categoria_gasto as enum
  ('local_infraestructura', 'publicidad', 'servicios', 'transporte', 'sueldos', 'alquiler', 'otros');
create type public.estado_gasto as enum ('planificado', 'realizado');

create table public.gastos (
  id               uuid primary key default gen_random_uuid(),
  estado           public.estado_gasto not null default 'planificado',
  fecha            date,                                   -- fecha del pago (realizado)
  fecha_estimada   date,                                   -- para los planificados
  categoria        public.categoria_gasto not null,
  descripcion      text not null check (length(btrim(descripcion)) between 1 and 500),
  proveedor        text check (length(proveedor) <= 200),
  monto_pen        numeric(14,2) not null check (monto_pen > 0),
  metodo_pago      public.payment_method check (metodo_pago <> 'mixto'),
  comprobante_path text check (length(comprobante_path) <= 500),  -- objeto en el bucket comprobantes-gastos
  creado_por       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint gasto_planificado_con_fecha_estimada check (
    estado <> 'planificado' or (fecha_estimada is not null and fecha is null)),
  constraint gasto_realizado_con_fecha_y_metodo check (
    estado <> 'realizado' or (fecha is not null and metodo_pago is not null))
);
comment on table public.gastos is
  'Gastos del negocio (M9). Nunca afectan el costo landing ni los precios (RN-22); se restan de la utilidad del mes (RN-23).';

create index gastos_fecha_idx          on public.gastos (fecha) where estado = 'realizado';
create index gastos_fecha_estimada_idx on public.gastos (fecha_estimada) where estado = 'planificado';
create index gastos_categoria_idx      on public.gastos (categoria);

-- creado_por lo fija el sistema (no se envía desde el cliente) y no cambia
create function public.guard_gasto() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
  else
    new.creado_por := old.creado_por;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

create trigger trg_guard_gasto before insert or update on public.gastos
  for each row execute function public.guard_gasto();
create trigger trg_updated_at before update on public.gastos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- seguridad (RN-24)
alter table public.gastos enable row level security;
create policy "solo admin: gastos" on public.gastos for all to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));

grant select, insert, update, delete on public.gastos to authenticated;
grant all on public.gastos to service_role;
revoke all on public.gastos from anon;

revoke execute on function public.guard_gasto() from public, anon;

-- ---------------------------------------------------------------- utilidad neta mensual (RN-23)
-- security_invoker: v_sales_margin (costos) y gastos son solo admin; otro rol ve 0 filas.
create view public.v_utilidad_mensual with (security_invoker = true) as
with ventas as (
  select date_trunc('month', confirmada_at at time zone 'America/Lima')::date as mes,
         count(*)                        as unidades_vendidas,
         sum(precio_unitario_pen)        as ventas_pen,
         sum(costo_landing_unitario_pen) as costo_landing_pen
  from public.v_sales_margin
  group by 1
), gastos as (
  select date_trunc('month', fecha)::date as mes,
         count(*)       as cantidad_gastos,
         sum(monto_pen) as gastos_pen
  from public.gastos
  where estado = 'realizado'
  group by 1
)
select coalesce(v.mes, g.mes)                                         as mes,
       coalesce(v.unidades_vendidas, 0)                               as unidades_vendidas,
       coalesce(v.ventas_pen, 0)                                      as ventas_pen,
       coalesce(v.costo_landing_pen, 0)                               as costo_landing_pen,
       coalesce(v.ventas_pen, 0) - coalesce(v.costo_landing_pen, 0)   as utilidad_bruta_pen,
       coalesce(g.cantidad_gastos, 0)                                 as cantidad_gastos,
       coalesce(g.gastos_pen, 0)                                      as gastos_pen,
       coalesce(v.ventas_pen, 0) - coalesce(v.costo_landing_pen, 0)
         - coalesce(g.gastos_pen, 0)                                  as utilidad_neta_pen
from ventas v
full join gastos g on g.mes = v.mes;

comment on view public.v_utilidad_mensual is
  'RN-23: utilidad neta por mes de Lima = ventas confirmadas − costo landing − gastos realizados. Solo admin.';

grant select on public.v_utilidad_mensual to authenticated, service_role;
revoke all on public.v_utilidad_mensual from anon;

-- ---------------------------------------------------------------- comprobantes en Storage (RN-24)
-- Bucket privado: los archivos se leen con URL firmada. Ruta: <gasto_id>/<archivo>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes-gastos', 'comprobantes-gastos', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "solo admin: comprobantes de gastos" on storage.objects for all to authenticated
  using (bucket_id = 'comprobantes-gastos' and (select public.has_role('admin')))
  with check (bucket_id = 'comprobantes-gastos' and (select public.has_role('admin')));
