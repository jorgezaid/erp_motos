-- =============================================================================
-- Administración de usuarios (SPEC M1, tarea 4.1)
--   · listar_usuarios(): perfiles + email de auth.users, solo para admin. El email no está en
--     public.profiles y auth.users no es accesible por RLS; por eso es SECURITY DEFINER.
--   · Un admin no puede quitarse su propio rol de admin ni desactivar su propia cuenta
--     (evita quedarse sin ningún administrador por un clic). D19.
-- =============================================================================

create function public.listar_usuarios()
returns table (id uuid, email text, nombre text, rol public.app_role, activo boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role('admin') then
    raise exception 'Solo un administrador puede ver la lista de usuarios' using errcode = '42501';
  end if;

  return query
    select p.id, u.email::text, p.nombre, p.rol, p.activo, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.rol nulls first, p.nombre, u.email;
end $$;

comment on function public.listar_usuarios() is
  'M1: usuarios con su email, rol y estado. Solo admin.';

revoke execute on function public.listar_usuarios() from public, anon;
grant  execute on function public.listar_usuarios() to authenticated;

-- Un admin no se quita su propio rol ni se desactiva
create function public.guard_self_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id = auth.uid() and old.rol = 'admin'
     and (new.rol is distinct from 'admin' or not new.activo) then
    raise exception 'No puedes quitarte tu propio rol de administrador ni desactivar tu cuenta: pídeselo a otro administrador';
  end if;
  return new;
end $$;

create trigger trg_guard_self_profile before update on public.profiles
  for each row execute function public.guard_self_profile();
