-- =============================================================================
-- Reclamos de garantía: máquina de estados (SPEC M7, tarea 8.1, D27)
--   abierto → en_revision → aprobado | rechazado → cerrado
-- Al pasar a revisión se registra el técnico (quien la atiende). Un reclamo cerrado no se edita.
-- La garantía y quién lo registró no cambian. (RN-19 ya valida la garantía al crear el reclamo.)
-- =============================================================================

create function public.guard_claim_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.estado = 'cerrado' then
    raise exception 'El reclamo está cerrado y no puede modificarse';
  end if;

  if (new.warranty_id, new.registrado_por, new.created_at) is distinct from (old.warranty_id, old.registrado_por, old.created_at) then
    raise exception 'No se puede cambiar la garantía ni quién registró el reclamo';
  end if;

  if new.estado is distinct from old.estado and not (
       (old.estado = 'abierto'     and new.estado = 'en_revision')
    or (old.estado = 'en_revision' and new.estado in ('aprobado', 'rechazado'))
    or (old.estado in ('aprobado', 'rechazado') and new.estado = 'cerrado')
  ) then
    raise exception 'Transición de reclamo no permitida: % → %', old.estado, new.estado;
  end if;

  if new.estado in ('aprobado', 'rechazado') and old.estado = 'en_revision'
     and coalesce(trim(new.diagnostico), '') = '' then
    raise exception 'Registra el diagnóstico antes de aprobar o rechazar el reclamo';
  end if;

  if new.estado = 'en_revision' and old.estado = 'abierto' then
    new.tecnico_id := coalesce(new.tecnico_id, auth.uid());
  end if;
  return new;
end $$;

create trigger trg_guard_claim_update before update on public.warranty_claims
  for each row execute function public.guard_claim_update();

-- Un reclamo nuevo siempre empieza abierto, sin diagnóstico ni técnico
create function public.claim_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.estado := 'abierto';
  new.diagnostico := null;
  new.tecnico_id := null;
  new.costo_reparacion_pen := null;
  new.registrado_por := coalesce(auth.uid(), new.registrado_por);
  return new;
end $$;

create trigger trg_claim_defaults before insert on public.warranty_claims
  for each row execute function public.claim_defaults();
