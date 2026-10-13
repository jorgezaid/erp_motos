-- =============================================================================
-- anon no ejecuta ninguna función de public (D30)
-- Postgres da EXECUTE a PUBLIC al crear cada función, y `seguridad_rls` solo lo revocó a las
-- que existían entonces: las creadas después (is_staff, can_edit_order y varias de trigger)
-- quedaban ejecutables por anon. authenticated y service_role conservan su EXECUTE explícito
-- (grants_roles_api): las políticas RLS usan has_role, is_staff y can_edit_order.
-- Los triggers no dependen de esto: Postgres comprueba EXECUTE al crear el trigger, no al
-- dispararlo (handle_new_user sigue creando el perfil al dar de alta un usuario en Auth).
-- Idempotente.
-- =============================================================================

revoke execute on all functions in schema public from anon, public;
grant  execute on all functions in schema public to authenticated, service_role;

-- Funciones futuras: sin el default de Supabase para anon. El EXECUTE de PUBLIC por defecto es
-- global (no se puede quitar solo en un esquema): cada migración que cree funciones debe
-- revocarlo, y tests/test_grants.sql falla si alguna queda ejecutable por anon.
alter default privileges for role postgres in schema public revoke execute on functions from anon;
