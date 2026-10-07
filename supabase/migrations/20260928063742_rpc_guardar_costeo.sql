-- =============================================================================
-- RPC guardar_costeo (SPEC §7 "Persistencia", RN-06)
-- Guarda el prorrateo que calcula src/lib/costing/prorrateo.ts en UNA transacción
-- (supabase-js no ofrece transacciones) y vuelve a validarlo en SQL (D7):
--   · el lote existe, tiene TC y no está liquidado;
--   · las filas son exactamente los modelos de batch_items, con su cantidad y el TC del lote;
--   · montos ≥ 0;
--   · invariante 1: por concepto, Σ asignado = total del lote (±0.01);
--   · invariante 4: por fila y concepto, asignado = total × base / Σ bases (±0.01),
--     y armado_pen = cantidad × costo_armado_unitario_pen (exacto);
--   · invariante 2: Σ costo_total_pen (columna generada) = fórmula del lote (±0.01).
-- Cualquier fallo aborta y deja intacto el costeo anterior.
--
-- p_filas: array JSON con el formato de FilaCosteo (mismos nombres de columna que
-- batch_model_costs); los montos pueden ir como string para no perder precisión.
-- SECURITY INVOKER: corre con el RLS del admin y respeta los triggers existentes.
-- =============================================================================

create function public.guardar_costeo(p_batch_id uuid, p_filas jsonb)
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

  -- ---------------------------------------------------------------- forma del JSON
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'El costeo del lote % no tiene filas', b.codigo_embarque;
  end if;

  begin
    v_filas := array(select x from jsonb_populate_recordset(null::public.batch_model_costs, p_filas) x);
  exception when others then
    raise exception 'El formato de las filas del costeo no es válido (montos numéricos y model_id como uuid)';
  end;

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
                 f.sueldos_asignado_pen, f.publicidad_asignada_pen, f.armado_pen) as minimo
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
  if v_total_exw = 0 then
    raise exception 'El lote % tiene EXW total 0: no se puede prorratear por valor', b.codigo_embarque;
  end if;

  for c in
    select * from (values
      ('fob_asignado_usd',                 'FOB',                 'US$', 'exw', b.fob_total_usd),
      ('impuestos_asignados_pen',          'impuestos',           'S/',  'exw', b.impuestos_asignables_pen),
      ('flete_internacional_asignado_usd', 'flete internacional', 'US$', 'cbm', b.flete_internacional_usd),
      ('gastos_agente_asignado_usd',       'gastos del agente',   'US$', 'cbm', b.gastos_agente_usd),
      ('flete_nacional_asignado_pen',      'flete nacional',      'S/',  'cbm', b.flete_nacional_pen),
      ('alquiler_asignado_pen',            'alquiler',            'S/',  'q',   b.alquiler_periodo_pen),
      ('sueldos_asignado_pen',             'sueldos',             'S/',  'q',   b.sueldos_periodo_pen),
      ('publicidad_asignada_pen',          'publicidad',          'S/',  'q',   b.publicidad_inicial_pen)
    ) v(columna, etiqueta, moneda, criterio, total)
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
    armado_pen, calculado_por)
  select p_batch_id, f.model_id, f.cantidad, f.tipo_cambio,
         f.fob_asignado_usd, f.impuestos_asignados_pen, f.flete_internacional_asignado_usd, f.gastos_agente_asignado_usd,
         f.flete_nacional_asignado_pen, f.alquiler_asignado_pen, f.sueldos_asignado_pen, f.publicidad_asignada_pen,
         f.armado_pen, auth.uid()
  from unnest(v_filas) f;

  -- ---------------------------------------------------------------- invariante 2
  -- Sobre la columna generada real, no sobre una copia de su fórmula
  select sum(k.costo_total_pen) into v_suma from public.batch_model_costs k where k.batch_id = p_batch_id;
  v_esperado := (b.fob_total_usd + b.flete_internacional_usd + b.gastos_agente_usd) * b.tipo_cambio
              + b.impuestos_asignables_pen + b.flete_nacional_pen + b.alquiler_periodo_pen
              + b.sueldos_periodo_pen + b.publicidad_inicial_pen + v_total_q * b.costo_armado_unitario_pen;
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
  'RN-06: guarda el prorrateo de un lote (formato FilaCosteo) validando los invariantes 1, 2 y 4 de SPEC §7. Solo admin.';

revoke execute on function public.guardar_costeo(uuid, jsonb) from public, anon;
grant  execute on function public.guardar_costeo(uuid, jsonb) to authenticated;
