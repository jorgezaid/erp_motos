-- =============================================================================
-- Compras locales (D41, tarea 17.3)
--   · import_batches.tipo_lote: 'importacion' (por defecto: los lotes existentes) o 'compra_local'
--     (proveedor de Lima, factura, fecha de compra, precio con o sin IGV, solo en PEN con TC = 1).
--     El tipo no cambia después de crear el lote.
--   · Una compra local no usa los montos de importación (FOB, fletes y agente en US$, tributos
--     SUNAT, alquiler, sueldos, publicidad): un CHECK los exige en 0. Sus gastos son el flete
--     Lima→Arequipa (flete_nacional_pen), el armado por unidad y otros_gastos_pen.
--   · batch_items.precio_compra_unitario_pen: obligatorio en una compra local y vacío en una
--     importación (guard_linea_lote). La cantidad sigue en cantidad_packing_list (RN-04 igual).
--   · batch_model_costs: compra_asignada_pen y otros_gastos_asignado_pen (0 en importación).
--     costo_total_pen y costo_landing_unitario_pen pasan de columnas generadas a columnas normales
--     (DROP EXPRESSION, PG ≥ 13: conserva los valores) que llena un trigger, con CHECK de la fórmula.
--   · Costeo de una compra local (SPEC §7 adaptado):
--       total_lineaᵢ = qᵢ × precio_compra_unitario_pen
--       con IGV incluido: compraᵢ = round(total_lineaᵢ / 1.18, 4) e IGVᵢ = total_lineaᵢ − compraᵢ
--       sin IGV incluido: compraᵢ = total_lineaᵢ e IGVᵢ = round(compraᵢ × 0.18, 4)
--       impuestos_asignados_pen = IGVᵢ si impuestos_recuperables_al_costo; si no, 0
--       flete y otros gastos: por cantidad (pQᵢ), con el residuo a la línea de mayor base
--       armado_pen = qᵢ × costo_armado_unitario_pen
--     guardar_costeo vuelve a validar estos invariantes; la importación sigue igual.
--   · Protección: foto de todos los lotes, líneas, costeos y price_list antes y después.
-- =============================================================================

create temp table _foto_lotes as select id, to_jsonb(b) - array['updated_at'] as fila from public.import_batches b;
create temp table _foto_items as select id, to_jsonb(i) as fila from public.batch_items i;
create temp table _foto_costos as select batch_id, to_jsonb(c) as fila from public.batch_model_costs c;
create temp table _foto_precios as select batch_id, to_jsonb(p) - array['updated_at'] as fila from public.price_list p;

-- ---------------------------------------------------------------- lote
create type public.tipo_lote as enum ('importacion', 'compra_local');

alter table public.import_batches
  add column tipo_lote          public.tipo_lote not null default 'importacion',
  add column nro_factura        text check (length(btrim(nro_factura)) between 1 and 40),
  add column fecha_compra       date,
  add column precio_incluye_igv boolean not null default true,
  add column otros_gastos_pen   numeric(14,2) not null default 0 check (otros_gastos_pen >= 0);

alter table public.import_batches add constraint import_batches_compra_local_check check (
  case tipo_lote
    when 'compra_local' then
      tipo_cambio = 1 and estado <> 'en_aduanas'
      and fob_total_usd = 0 and flete_internacional_usd = 0 and gastos_agente_usd = 0
      and ad_valorem_pen = 0 and igv_pen = 0 and ipm_pen = 0 and percepcion_pen = 0
      and alquiler_periodo_pen = 0 and sueldos_periodo_pen = 0 and publicidad_inicial_pen = 0
    else otros_gastos_pen = 0
  end);

create index on public.import_batches (tipo_lote);

create function public.guard_tipo_lote() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.tipo_lote is distinct from old.tipo_lote then
    raise exception 'El lote % no puede cambiar de tipo (importación o compra local)', old.codigo_embarque;
  end if;
  return new;
end $$;

revoke execute on function public.guard_tipo_lote() from public, anon;
grant execute on function public.guard_tipo_lote() to authenticated, service_role;

create trigger trg_guard_tipo_lote before update of tipo_lote on public.import_batches
  for each row execute function public.guard_tipo_lote();

-- ---------------------------------------------------------------- líneas
alter table public.batch_items
  add column precio_compra_unitario_pen numeric(12,2) check (precio_compra_unitario_pen >= 0);

-- Reemplaza la de 20261023123636: ahora depende del tipo de lote
create or replace function public.guard_linea_lote() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_tipo   public.tipo_lote;
  v_codigo text;
begin
  select tipo_lote into v_tipo from public.import_batches where id = new.batch_id;
  select codigo_modelo into v_codigo from public.vehicle_models where id = new.model_id;
  if v_tipo = 'compra_local' then
    if new.precio_compra_unitario_pen is null then
      raise exception 'Indica el precio de compra unitario del modelo %', v_codigo;
    end if;
  else
    if new.exw_usd_unitario is null or new.volumen_cbm_unitario is null then
      raise exception 'El modelo % no tiene EXW/CBM: indícalos en la línea', v_codigo;
    end if;
    if new.precio_compra_unitario_pen is not null then
      raise exception 'El precio de compra en soles es solo para compras locales (modelo %)', v_codigo;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- costeo
alter table public.batch_model_costs
  add column compra_asignada_pen       numeric(16,4) not null default 0,
  add column otros_gastos_asignado_pen numeric(16,4) not null default 0;

-- Columnas generadas → normales (conservan los valores actuales)
alter table public.batch_model_costs alter column costo_total_pen drop expression;
alter table public.batch_model_costs alter column costo_landing_unitario_pen drop expression;

-- Misma fórmula que la columna generada original, más compra y otros gastos (0 en importación)
create function public.costo_total_fila(c public.batch_model_costs) returns numeric
language sql immutable set search_path = '' as $$
  select (c.fob_asignado_usd + c.flete_internacional_asignado_usd + c.gastos_agente_asignado_usd) * c.tipo_cambio
       + c.impuestos_asignados_pen + c.flete_nacional_asignado_pen
       + c.alquiler_asignado_pen + c.sueldos_asignado_pen + c.publicidad_asignada_pen + c.armado_pen
       + c.compra_asignada_pen + c.otros_gastos_asignado_pen
$$;

revoke execute on function public.costo_total_fila(public.batch_model_costs) from public, anon;
grant execute on function public.costo_total_fila(public.batch_model_costs) to authenticated, service_role;

create function public.calcular_costo_total() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.costo_total_pen            := public.costo_total_fila(new)::numeric(16,4);
  new.costo_landing_unitario_pen := round(public.costo_total_fila(new) / new.cantidad, 2);
  return new;
end $$;

revoke execute on function public.calcular_costo_total() from public, anon;
grant execute on function public.calcular_costo_total() to authenticated, service_role;

create trigger trg_calcular_costo_total before insert or update on public.batch_model_costs
  for each row execute function public.calcular_costo_total();

alter table public.batch_model_costs alter column costo_total_pen set not null;
alter table public.batch_model_costs alter column costo_landing_unitario_pen set not null;
alter table public.batch_model_costs add constraint batch_model_costs_costo_total_check check (
  costo_total_pen = public.costo_total_fila(batch_model_costs)::numeric(16,4)
  and costo_landing_unitario_pen = round(public.costo_total_fila(batch_model_costs) / cantidad, 2));

-- ---------------------------------------------------------------- invalidar el costeo (D21)
drop trigger trg_invalidar_costeo on public.import_batches;
create trigger trg_invalidar_costeo after update on public.import_batches
  for each row
  when (old.estado <> 'liquidado' and new.estado <> 'liquidado' and
        (old.tipo_cambio, old.fob_total_usd, old.flete_internacional_usd, old.gastos_agente_usd,
         old.ad_valorem_pen, old.igv_pen, old.ipm_pen, old.percepcion_pen, old.impuestos_recuperables_al_costo,
         old.flete_nacional_pen, old.alquiler_periodo_pen, old.sueldos_periodo_pen, old.publicidad_inicial_pen,
         old.costo_armado_unitario_pen, old.otros_gastos_pen, old.precio_incluye_igv)
        is distinct from
        (new.tipo_cambio, new.fob_total_usd, new.flete_internacional_usd, new.gastos_agente_usd,
         new.ad_valorem_pen, new.igv_pen, new.ipm_pen, new.percepcion_pen, new.impuestos_recuperables_al_costo,
         new.flete_nacional_pen, new.alquiler_periodo_pen, new.sueldos_periodo_pen, new.publicidad_inicial_pen,
         new.costo_armado_unitario_pen, new.otros_gastos_pen, new.precio_incluye_igv))
  execute function public.invalidar_costeo();

drop trigger trg_invalidar_costeo_cambio on public.batch_items;
create trigger trg_invalidar_costeo_cambio after update on public.batch_items
  for each row
  when ((old.cantidad_packing_list, old.exw_usd_unitario, old.volumen_cbm_unitario, old.precio_compra_unitario_pen)
        is distinct from (new.cantidad_packing_list, new.exw_usd_unitario, new.volumen_cbm_unitario, new.precio_compra_unitario_pen))
  execute function public.invalidar_costeo();

-- ---------------------------------------------------------------- RPC guardar_costeo
-- Igual que en 20260928063742_rpc_guardar_costeo para la importación; agrega la rama de la
-- compra local y las columnas compra_asignada_pen y otros_gastos_asignado_pen (si no vienen, 0).
create or replace function public.guardar_costeo(p_batch_id uuid, p_filas jsonb)
returns setof public.batch_model_costs
language plpgsql security invoker set search_path = '' as $$
declare
  b           public.import_batches;
  v_filas     public.batch_model_costs[];
  v_lista     text;
  v_total_q   numeric;
  v_total_exw numeric;
  v_total_cbm numeric;
  v_suma      numeric;
  v_esperado  numeric;
  v_local     boolean;
  c           record;
  r           record;
begin
  if not public.has_role('admin') then
    raise exception 'Solo un administrador puede guardar el costeo de un lote' using errcode = '42501';
  end if;

  -- Bloquea el lote: nadie lo liquida ni cambia sus montos mientras se guarda
  select * into b from public.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'El lote no existe o no tiene acceso a él' using errcode = 'P0002';
  end if;
  if b.estado = 'liquidado' then
    raise exception 'El lote % está liquidado: reábralo antes de recalcular el costeo', b.codigo_embarque;
  end if;
  if b.tipo_cambio is null then
    raise exception 'El lote % no tiene tipo de cambio: regístrelo antes de guardar el costeo', b.codigo_embarque;
  end if;
  v_local := b.tipo_lote = 'compra_local';

  -- ---------------------------------------------------------------- forma del JSON
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'El costeo del lote % no tiene filas', b.codigo_embarque;
  end if;

  begin
    v_filas := array(select x from jsonb_populate_recordset(null::public.batch_model_costs, p_filas) x);
  exception when others then
    raise exception 'El formato de las filas del costeo no es válido (montos numéricos y model_id como uuid)';
  end;
  -- Las columnas de la compra local pueden faltar (costeo de importación)
  v_filas := array(select (f.batch_id, f.model_id, f.cantidad, f.tipo_cambio, f.fob_asignado_usd,
                           f.impuestos_asignados_pen, f.flete_internacional_asignado_usd,
                           f.gastos_agente_asignado_usd, f.flete_nacional_asignado_pen, f.alquiler_asignado_pen,
                           f.sueldos_asignado_pen, f.publicidad_asignada_pen, f.armado_pen, f.costo_total_pen,
                           f.costo_landing_unitario_pen, f.calculado_at, f.calculado_por,
                           coalesce(f.compra_asignada_pen, 0), coalesce(f.otros_gastos_asignado_pen, 0)
                          )::public.batch_model_costs
                   from unnest(v_filas) f);

  if exists (select 1 from unnest(v_filas) f
             where num_nulls(f.model_id, f.cantidad, f.tipo_cambio, f.fob_asignado_usd, f.impuestos_asignados_pen,
                             f.flete_internacional_asignado_usd, f.gastos_agente_asignado_usd,
                             f.flete_nacional_asignado_pen, f.alquiler_asignado_pen, f.sueldos_asignado_pen,
                             f.publicidad_asignada_pen, f.armado_pen) > 0) then
    raise exception 'El costeo del lote % tiene filas con campos vacíos', b.codigo_embarque;
  end if;

  -- ---------------------------------------------------------------- modelos exactos
  select string_agg(coalesce(m.codigo_modelo, d.model_id::text), ', ' order by m.codigo_modelo) into v_lista
  from (select f.model_id from unnest(v_filas) f group by f.model_id having count(*) > 1) d
  left join public.vehicle_models m on m.id = d.model_id;
  if v_lista is not null then
    raise exception 'El costeo del lote % tiene modelos repetidos: %', b.codigo_embarque, v_lista;
  end if;

  select string_agg(m.codigo_modelo, ', ' order by m.codigo_modelo) into v_lista
  from public.batch_items i
  join public.vehicle_models m on m.id = i.model_id
  where i.batch_id = p_batch_id
    and not exists (select 1 from unnest(v_filas) f where f.model_id = i.model_id);
  if v_lista is not null then
    raise exception 'Falta el costeo de: % (lote %)', v_lista, b.codigo_embarque;
  end if;

  select string_agg(coalesce(m.codigo_modelo, f.model_id::text), ', ' order by m.codigo_modelo) into v_lista
  from unnest(v_filas) f
  left join public.vehicle_models m on m.id = f.model_id
  where not exists (select 1 from public.batch_items i where i.batch_id = p_batch_id and i.model_id = f.model_id);
  if v_lista is not null then
    raise exception 'Sobran filas de modelos que no están en el packing list: % (lote %)', v_lista, b.codigo_embarque;
  end if;

  -- ---------------------------------------------------------------- por fila
  for r in
    select m.codigo_modelo, f.cantidad, f.tipo_cambio, i.cantidad_packing_list,
           least(f.fob_asignado_usd, f.impuestos_asignados_pen, f.flete_internacional_asignado_usd,
                 f.gastos_agente_asignado_usd, f.flete_nacional_asignado_pen, f.alquiler_asignado_pen,
                 f.sueldos_asignado_pen, f.publicidad_asignada_pen, f.armado_pen,
                 f.compra_asignada_pen, f.otros_gastos_asignado_pen) as minimo
    from unnest(v_filas) f
    join public.batch_items i on i.batch_id = p_batch_id and i.model_id = f.model_id
    join public.vehicle_models m on m.id = f.model_id
    order by m.codigo_modelo
  loop
    if r.cantidad <> r.cantidad_packing_list then
      raise exception 'Modelo %: la cantidad del costeo (%) no coincide con la del packing list (%)',
        r.codigo_modelo, r.cantidad, r.cantidad_packing_list;
    end if;
    if r.tipo_cambio <> b.tipo_cambio then
      raise exception 'Modelo %: el tipo de cambio del costeo (%) no coincide con el del lote (%)',
        r.codigo_modelo, r.tipo_cambio, b.tipo_cambio;
    end if;
    if r.minimo < 0 then
      raise exception 'Modelo %: el costeo tiene un monto negativo', r.codigo_modelo;
    end if;
  end loop;

  -- ---------------------------------------------------------------- invariantes 1 y 4
  select sum(i.cantidad_packing_list), sum(i.exw_total_usd), sum(i.cbm_total)
    into v_total_q, v_total_exw, v_total_cbm
  from public.batch_items i where i.batch_id = p_batch_id;
  if not v_local and v_total_exw = 0 then
    raise exception 'El lote % tiene EXW total 0: no se puede prorratear por valor', b.codigo_embarque;
  end if;

  for c in
    select * from (values
      ('fob_asignado_usd',                 'FOB',                 'US$', 'exw', b.fob_total_usd),
      ('flete_internacional_asignado_usd', 'flete internacional', 'US$', 'cbm', b.flete_internacional_usd),
      ('gastos_agente_asignado_usd',       'gastos del agente',   'US$', 'cbm', b.gastos_agente_usd),
      ('alquiler_asignado_pen',            'alquiler',            'S/',  'q',   b.alquiler_periodo_pen),
      ('sueldos_asignado_pen',             'sueldos',             'S/',  'q',   b.sueldos_periodo_pen),
      ('publicidad_asignada_pen',          'publicidad',          'S/',  'q',   b.publicidad_inicial_pen),
      ('otros_gastos_asignado_pen',        'otros gastos',        'S/',  'q',   b.otros_gastos_pen),
      -- Importación: tributos por valor y flete nacional por volumen. Compra local: el IGV se
      -- valida por fila más abajo y el flete Lima→Arequipa va por cantidad.
      ('impuestos_asignados_pen',          'impuestos',           'S/',  'exw', b.impuestos_asignables_pen),
      ('flete_nacional_asignado_pen',      'flete nacional',      'S/',  case when v_local then 'q' else 'cbm' end,
                                                                           b.flete_nacional_pen)
    ) v(columna, etiqueta, moneda, criterio, total)
    where not (v_local and v.columna = 'impuestos_asignados_pen')
      -- En compra local los conceptos de importación valen 0 (CHECK del lote): se comprueba la suma
      and not (v_local and v.criterio in ('exw', 'cbm'))
  loop
    -- Invariante 1: el concepto cuadra con el total del lote
    select sum((to_jsonb(f) ->> c.columna)::numeric) into v_suma from unnest(v_filas) f;
    if abs(v_suma - c.total) > 0.01 then
      raise exception 'Costeo descuadrado: % asignado suma % %, pero el total del lote es % %',
        c.etiqueta, c.moneda, v_suma, c.moneda, c.total;
    end if;

    -- Invariante 4: cada fila recibe su parte según la base de su criterio
    for r in
      select m.codigo_modelo, (to_jsonb(f) ->> c.columna)::numeric as asignado,
             c.total * case c.criterio
                         when 'exw' then i.exw_total_usd / v_total_exw
                         when 'cbm' then i.cbm_total / v_total_cbm
                         else i.cantidad_packing_list / v_total_q
                       end as esperado
      from unnest(v_filas) f
      join public.batch_items i on i.batch_id = p_batch_id and i.model_id = f.model_id
      join public.vehicle_models m on m.id = f.model_id
      order by m.codigo_modelo
    loop
      if abs(r.asignado - r.esperado) > 0.01 then
        raise exception 'Modelo %: % asignado % %, esperado % %',
          r.codigo_modelo, c.etiqueta, c.moneda, round(r.asignado, 4), c.moneda, round(r.esperado, 4);
      end if;
    end loop;
  end loop;

  -- Compra local: los conceptos de importación en 0 (por valor o volumen no hay base)
  if v_local and exists (select 1 from unnest(v_filas) f
                         where f.fob_asignado_usd <> 0 or f.flete_internacional_asignado_usd <> 0
                            or f.gastos_agente_asignado_usd <> 0) then
    raise exception 'El costeo de la compra local % tiene montos de importación', b.codigo_embarque;
  end if;

  -- Compra (directa) e IGV, exactos por fila
  for r in
    select m.codigo_modelo, f.compra_asignada_pen, f.impuestos_asignados_pen,
           x.compra as compra_esperada,
           case when b.impuestos_recuperables_al_costo then x.total - x.compra else 0 end as igv_esperado
    from unnest(v_filas) f
    join public.batch_items i on i.batch_id = p_batch_id and i.model_id = f.model_id
    join public.vehicle_models m on m.id = f.model_id
    cross join lateral (
      select i.cantidad_packing_list * coalesce(i.precio_compra_unitario_pen, 0) as linea) t
    cross join lateral (
      select case when b.precio_incluye_igv then round(t.linea / 1.18, 4) else t.linea end as compra,
             case when b.precio_incluye_igv then t.linea else t.linea + round(t.linea * 0.18, 4) end as total) x
    order by m.codigo_modelo
  loop
    if not v_local then
      if r.compra_asignada_pen <> 0 then
        raise exception 'Modelo %: un lote de importación no lleva precio de compra en soles', r.codigo_modelo;
      end if;
    elsif r.compra_asignada_pen <> r.compra_esperada then
      raise exception 'Modelo %: compra asignada S/ %, esperada S/ %',
        r.codigo_modelo, round(r.compra_asignada_pen, 4), round(r.compra_esperada, 4);
    elsif r.impuestos_asignados_pen <> r.igv_esperado then
      raise exception 'Modelo %: IGV asignado S/ %, esperado S/ %',
        r.codigo_modelo, round(r.impuestos_asignados_pen, 4), round(r.igv_esperado, 4);
    end if;
  end loop;

  -- Armado: costo directo, exacto
  for r in
    select m.codigo_modelo, f.armado_pen, f.cantidad * b.costo_armado_unitario_pen as esperado
    from unnest(v_filas) f
    join public.vehicle_models m on m.id = f.model_id
    order by m.codigo_modelo
  loop
    if r.armado_pen <> r.esperado then
      raise exception 'Modelo %: armado asignado S/ %, esperado S/ %',
        r.codigo_modelo, round(r.armado_pen, 4), round(r.esperado, 4);
    end if;
  end loop;

  -- ---------------------------------------------------------------- reemplazo
  delete from public.batch_model_costs where batch_id = p_batch_id;

  insert into public.batch_model_costs (batch_id, model_id, cantidad, tipo_cambio,
    fob_asignado_usd, impuestos_asignados_pen, flete_internacional_asignado_usd, gastos_agente_asignado_usd,
    flete_nacional_asignado_pen, alquiler_asignado_pen, sueldos_asignado_pen, publicidad_asignada_pen,
    armado_pen, compra_asignada_pen, otros_gastos_asignado_pen, calculado_por)
  select p_batch_id, f.model_id, f.cantidad, f.tipo_cambio,
         f.fob_asignado_usd, f.impuestos_asignados_pen, f.flete_internacional_asignado_usd, f.gastos_agente_asignado_usd,
         f.flete_nacional_asignado_pen, f.alquiler_asignado_pen, f.sueldos_asignado_pen, f.publicidad_asignada_pen,
         f.armado_pen, f.compra_asignada_pen, f.otros_gastos_asignado_pen, auth.uid()
  from unnest(v_filas) f;

  -- ---------------------------------------------------------------- invariante 2
  select sum(k.costo_total_pen) into v_suma from public.batch_model_costs k where k.batch_id = p_batch_id;
  if v_local then
    select sum(k.compra_asignada_pen + k.impuestos_asignados_pen) into v_esperado
    from public.batch_model_costs k where k.batch_id = p_batch_id;
    v_esperado := v_esperado + b.flete_nacional_pen + b.otros_gastos_pen + v_total_q * b.costo_armado_unitario_pen;
  else
    v_esperado := (b.fob_total_usd + b.flete_internacional_usd + b.gastos_agente_usd) * b.tipo_cambio
                + b.impuestos_asignables_pen + b.flete_nacional_pen + b.alquiler_periodo_pen
                + b.sueldos_periodo_pen + b.publicidad_inicial_pen + v_total_q * b.costo_armado_unitario_pen;
  end if;
  if abs(v_suma - v_esperado) > 0.01 then
    raise exception 'El costo total del lote % no cuadra: las filas suman S/ %, y el lote S/ %',
      b.codigo_embarque, round(v_suma, 2), round(v_esperado, 2);
  end if;

  return query
    select k.* from public.batch_model_costs k
    join public.vehicle_models m on m.id = k.model_id
    where k.batch_id = p_batch_id
    order by m.codigo_modelo;
end $$;

comment on function public.guardar_costeo(uuid, jsonb) is
  'RN-06: guarda el costeo de un lote (formato FilaCosteo) validando los invariantes de SPEC §7; en una compra local (D41), compra e IGV exactos y flete y otros gastos por cantidad. Solo admin.';

revoke execute on function public.guardar_costeo(uuid, jsonb) from public, anon;
grant  execute on function public.guardar_costeo(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- comprobación
do $$
declare
  v_cambios int;
begin
  select count(*) into v_cambios from (
    (select id, fila from _foto_lotes
     except select id, to_jsonb(b) - array['updated_at', 'tipo_lote', 'nro_factura', 'fecha_compra',
                                            'precio_incluye_igv', 'otros_gastos_pen'] from public.import_batches b)
    union all
    (select id, to_jsonb(b) - array['updated_at', 'tipo_lote', 'nro_factura', 'fecha_compra',
                                     'precio_incluye_igv', 'otros_gastos_pen'] from public.import_batches b
     except select id, fila from _foto_lotes)
    union all
    (select id, fila from _foto_items except select id, to_jsonb(i) - 'precio_compra_unitario_pen' from public.batch_items i)
    union all
    (select id, to_jsonb(i) - 'precio_compra_unitario_pen' from public.batch_items i except select id, fila from _foto_items)
    union all
    (select batch_id, fila from _foto_costos
     except select batch_id, to_jsonb(c) - array['compra_asignada_pen', 'otros_gastos_asignado_pen'] from public.batch_model_costs c)
    union all
    (select batch_id, to_jsonb(c) - array['compra_asignada_pen', 'otros_gastos_asignado_pen'] from public.batch_model_costs c
     except select batch_id, fila from _foto_costos)
    union all
    (select batch_id, fila from _foto_precios
     except select batch_id, to_jsonb(p) - array['updated_at'] from public.price_list p)
    union all
    (select batch_id, to_jsonb(p) - array['updated_at'] from public.price_list p
     except select batch_id, fila from _foto_precios)) x;
  if v_cambios > 0 then
    raise exception 'Migración compra_local abortada: cambiarían % fila(s) de lotes, líneas, costeos o precios', v_cambios;
  end if;
  if exists (select 1 from public.import_batches where tipo_lote <> 'importacion') then
    raise exception 'Migración compra_local abortada: los lotes existentes deben quedar como importación';
  end if;
end $$;

drop table _foto_lotes, _foto_items, _foto_costos, _foto_precios;
