-- ⚠️⚠️⚠️ SOLO LOCAL — contiene contraseñas conocidas ⚠️⚠️⚠️
-- NUNCA ejecutar en Supabase Cloud ni en producción.
-- =============================================================================
-- Usuarios de prueba para desarrollo local. Los carga `pnpm db:demo` (scripts/db-demo.mjs)
-- en el contenedor de la BD local. No está en sql_paths de config.toml: ningún comando de la
-- CLI (db reset, db push, db push --include-seed) lo ejecuta. Tampoco lo usa tests/run.sh.
-- Contraseña de todos: Demo1234!
--   admin@demo.pe      → admin
--   tecnico@demo.pe    → tecnico
--   vendedor@demo.pe   → vendedor
--   vendedor2@demo.pe  → vendedor (para probar que un vendedor no edita órdenes ajenas)
--   pendiente@demo.pe  → sin rol (ve "Tu cuenta espera aprobación")
-- =============================================================================
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@demo.pe',     'Ana Admin',      'admin'),
      ('00000000-0000-4000-a000-000000000002'::uuid, 'tecnico@demo.pe',   'Tito Técnico',   'tecnico'),
      ('00000000-0000-4000-a000-000000000003'::uuid, 'vendedor@demo.pe',  'Vero Vendedora', 'vendedor'),
      ('00000000-0000-4000-a000-000000000004'::uuid, 'vendedor2@demo.pe', 'Víctor Vendedor','vendedor'),
      ('00000000-0000-4000-a000-000000000005'::uuid, 'pendiente@demo.pe', 'Pepe Pendiente', null)
    ) t(id, email, nombre, rol)
  loop
    -- GoTrue no admite NULL en los tokens: van como cadena vacía
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
            extensions.crypt('Demo1234!', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', u.nombre), now(), now(),
            '', '', '', '')
    on conflict (id) do nothing;

    insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now())
    on conflict do nothing;

    -- El trigger on_auth_user_created ya creó el perfil sin rol
    update public.profiles set rol = u.rol::public.app_role where id = u.id;
  end loop;
end $$;
