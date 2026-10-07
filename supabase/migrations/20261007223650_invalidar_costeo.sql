-- =============================================================================
-- Costeo desactualizado (RN-06/RN-07, tarea 5.2, D21)
-- El costeo guardado (batch_model_costs) es una foto de los montos del lote y de su packing list.
-- Si alguno cambia antes de liquidar, esa foto ya no cuadra: se borra y hay que volver a
-- guardarlo. Así RN-07 (liquidar exige costeo vigente) no deja liquidar con costos viejos.
-- (Un lote liquidado ya no admite estos cambios: guard_batch_update / guard_batch_not_liquidated.)
-- SECURITY INVOKER: solo el admin modifica lotes y packing list, y tiene permiso sobre el costeo.
-- =============================================================================

create function public.invalidar_costeo() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_batch uuid;
begin
  if tg_table_name = 'import_batches' then
    v_batch := new.id;
  elsif tg_op = 'DELETE' then
    v_batch := old.batch_id;
  else
    v_batch := new.batch_id;
  end if;
  delete from public.batch_model_costs where batch_id = v_batch;
  return null;
end $$;

comment on function public.invalidar_costeo() is
  'D21: borra el costeo guardado de un lote cuando cambian sus montos o su packing list.';

-- Montos del lote que entran al prorrateo (las notas, fechas, DAM o estado no lo afectan)
create trigger trg_invalidar_costeo after update on public.import_batches
  for each row
  when (old.estado <> 'liquidado' and new.estado <> 'liquidado' and
        (old.tipo_cambio, old.fob_total_usd, old.flete_internacional_usd, old.gastos_agente_usd,
         old.ad_valorem_pen, old.igv_pen, old.ipm_pen, old.percepcion_pen, old.impuestos_recuperables_al_costo,
         old.flete_nacional_pen, old.alquiler_periodo_pen, old.sueldos_periodo_pen, old.publicidad_inicial_pen,
         old.costo_armado_unitario_pen)
        is distinct from
        (new.tipo_cambio, new.fob_total_usd, new.flete_internacional_usd, new.gastos_agente_usd,
         new.ad_valorem_pen, new.igv_pen, new.ipm_pen, new.percepcion_pen, new.impuestos_recuperables_al_costo,
         new.flete_nacional_pen, new.alquiler_periodo_pen, new.sueldos_periodo_pen, new.publicidad_inicial_pen,
         new.costo_armado_unitario_pen))
  execute function public.invalidar_costeo();

-- Packing list: altas, bajas y cambios de cantidad, EXW o CBM (la cantidad de la DAM no afecta)
create trigger trg_invalidar_costeo_alta after insert on public.batch_items
  for each row execute function public.invalidar_costeo();
create trigger trg_invalidar_costeo_baja after delete on public.batch_items
  for each row execute function public.invalidar_costeo();
create trigger trg_invalidar_costeo_cambio after update on public.batch_items
  for each row
  when ((old.cantidad_packing_list, old.exw_usd_unitario, old.volumen_cbm_unitario)
        is distinct from (new.cantidad_packing_list, new.exw_usd_unitario, new.volumen_cbm_unitario))
  execute function public.invalidar_costeo();
