-- =============================================================================
-- ERP Vehículos Eléctricos — Migración 3/3: Seguridad (Row Level Security)
-- =============================================================================
-- Matriz de acceso
-- ┌─────────────────────────────┬──────────────┬──────────────┬──────────────┐
-- │ Tabla                       │ Admin        │ Técnico      │ Vendedor     │
-- ├─────────────────────────────┼──────────────┼──────────────┼──────────────┤
-- │ import_batches / items /    │ total        │ —            │ —            │
-- │ batch_model_costs (COSTOS)  │              │              │              │
-- │ vehicle_models, locations   │ total        │ lectura      │ lectura      │
-- │ price_margins               │ total        │ lectura      │ lectura      │
-- │ price_list (precios)        │ total        │ —            │ lectura      │
-- │ vehicle_inventory           │ total        │ lee/crea/edita│ lectura     │
-- │ vehicle_batteries           │ total        │ lee/crea/edita│ lectura     │
-- │ technical_inspections       │ total        │ lee/crea     │ lectura      │
-- │ sales_orders/items/payments │ total        │ lectura      │ lee todo; crea/edita las suyas │
-- │ warranties                  │ lectura      │ lectura      │ lectura      │
-- │ warranty_claims             │ total        │ lee/crea/edita│ lee/crea    │
-- └─────────────────────────────┴──────────────┴──────────────┴──────────────┘
-- Usuarios sin rol (pendientes de aprobación) y `anon` no ven nada.
-- =============================================================================

-- Defensa en profundidad: el rol anónimo no toca ninguna tabla del ERP
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant  execute on all functions in schema public to authenticated, service_role;

alter table public.profiles               enable row level security;
alter table public.locations              enable row level security;
alter table public.vehicle_models         enable row level security;
alter table public.import_batches         enable row level security;
alter table public.batch_items            enable row level security;
alter table public.batch_model_costs      enable row level security;
alter table public.price_margins          enable row level security;
alter table public.price_list             enable row level security;
alter table public.vehicle_inventory      enable row level security;
alter table public.vehicle_batteries      enable row level security;
alter table public.technical_inspections  enable row level security;
alter table public.vehicle_status_history enable row level security;
alter table public.sales_orders           enable row level security;
alter table public.order_items            enable row level security;
alter table public.payments               enable row level security;
alter table public.warranties             enable row level security;
alter table public.warranty_claims        enable row level security;

-- Atajo: "es personal activo con algún rol"
create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_app_role() is not null
$$;
grant execute on function public.is_staff() to authenticated;

-- ---------------------------------------------------------------- profiles
create policy "staff ve perfiles"          on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy "cada uno edita su perfil"   on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.has_role('admin')))
  with check (id = (select auth.uid()) or (select public.has_role('admin')));

-- ---------------------------------------------------------------- catálogos
create policy "staff lee ubicaciones"      on public.locations for select to authenticated using ((select public.is_staff()));
create policy "admin gestiona ubicaciones" on public.locations for all    to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));

create policy "staff lee modelos"          on public.vehicle_models for select to authenticated using ((select public.is_staff()));
create policy "admin gestiona modelos"     on public.vehicle_models for all    to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));

create policy "staff lee márgenes"         on public.price_margins for select to authenticated using ((select public.is_staff()));
create policy "admin edita márgenes"       on public.price_margins for update to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));

-- ---------------------------------------------------------------- costos (solo admin)
create policy "solo admin: lotes"          on public.import_batches for all to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));
create policy "solo admin: packing list"   on public.batch_items for all to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));
create policy "solo admin: costeo"         on public.batch_model_costs for all to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));

-- ---------------------------------------------------------------- precios
create policy "admin y ventas leen precios" on public.price_list for select to authenticated
  using ((select public.has_role('admin', 'vendedor')));
create policy "admin ajusta precios"        on public.price_list for update to authenticated
  using ((select public.has_role('admin'))) with check ((select public.has_role('admin')));

-- ---------------------------------------------------------------- inventario y taller
create policy "staff lee inventario"         on public.vehicle_inventory for select to authenticated using ((select public.is_staff()));
create policy "admin/técnico registran"      on public.vehicle_inventory for insert to authenticated
  with check ((select public.has_role('admin', 'tecnico')));
create policy "admin/técnico actualizan"     on public.vehicle_inventory for update to authenticated
  using ((select public.has_role('admin', 'tecnico'))) with check ((select public.has_role('admin', 'tecnico')));
create policy "admin elimina unidades"       on public.vehicle_inventory for delete to authenticated
  using ((select public.has_role('admin')) and estado = 'en_caja');

create policy "staff lee baterías"           on public.vehicle_batteries for select to authenticated using ((select public.is_staff()));
create policy "admin/técnico gestionan baterías" on public.vehicle_batteries for all to authenticated
  using ((select public.has_role('admin', 'tecnico'))) with check ((select public.has_role('admin', 'tecnico')));

create policy "staff lee inspecciones"       on public.technical_inspections for select to authenticated using ((select public.is_staff()));
create policy "admin/técnico inspeccionan"   on public.technical_inspections for insert to authenticated
  with check ((select public.has_role('admin', 'tecnico')));
-- Sin políticas de UPDATE/DELETE para técnicos: una inspección es un registro de auditoría
create policy "admin corrige inspecciones"   on public.technical_inspections for delete to authenticated
  using ((select public.has_role('admin')));

create policy "staff lee historial"          on public.vehicle_status_history for select to authenticated using ((select public.is_staff()));

-- ---------------------------------------------------------------- ventas
create policy "staff lee órdenes"            on public.sales_orders for select to authenticated using ((select public.is_staff()));
create policy "admin/ventas crean órdenes"   on public.sales_orders for insert to authenticated
  with check ((select public.has_role('admin', 'vendedor')));
create policy "admin o dueño edita orden"    on public.sales_orders for update to authenticated
  using ((select public.has_role('admin'))
         or ((select public.has_role('vendedor')) and vendedor_id = (select auth.uid())))
  with check ((select public.has_role('admin'))
         or ((select public.has_role('vendedor')) and vendedor_id = (select auth.uid())));
create policy "admin o dueño borra borrador" on public.sales_orders for delete to authenticated
  using (estado = 'borrador' and ((select public.has_role('admin'))
         or ((select public.has_role('vendedor')) and vendedor_id = (select auth.uid()))));

-- Ítems y pagos: se crean/borran si puedes editar la orden. Nunca se actualizan
-- directamente (el precio lo pone el sistema).
create function public.can_edit_order(p_order_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sales_orders o
    where o.id = p_order_id
      and (public.has_role('admin')
           or (public.has_role('vendedor') and o.vendedor_id = auth.uid())))
$$;
grant execute on function public.can_edit_order(uuid) to authenticated;

create policy "staff lee ítems"      on public.order_items for select to authenticated using ((select public.is_staff()));
create policy "agrega ítems"         on public.order_items for insert to authenticated with check (public.can_edit_order(order_id));
create policy "quita ítems"          on public.order_items for delete to authenticated using (public.can_edit_order(order_id));

create policy "staff lee pagos"      on public.payments for select to authenticated using ((select public.is_staff()));
create policy "registra pagos"       on public.payments for insert to authenticated with check (public.can_edit_order(order_id));
create policy "elimina pagos"        on public.payments for delete to authenticated using (public.can_edit_order(order_id));

-- ---------------------------------------------------------------- garantías
create policy "staff lee garantías"  on public.warranties for select to authenticated using ((select public.is_staff()));

create policy "staff lee reclamos"   on public.warranty_claims for select to authenticated using ((select public.is_staff()));
create policy "staff registra reclamos" on public.warranty_claims for insert to authenticated with check ((select public.is_staff()));
create policy "admin/técnico atienden reclamos" on public.warranty_claims for update to authenticated
  using ((select public.has_role('admin', 'tecnico'))) with check ((select public.has_role('admin', 'tecnico')));
