-- =============================================================================
-- Helpers compartidos por las pruebas (tests/run.sh los carga en cada BD limpia,
-- antes de cada tests/test_*.sql).
-- =============================================================================
create schema test;
grant usage on schema test to authenticated, anon;

-- Ejecuta SQL y exige que falle con un mensaje que contenga `patron`
create function test.expect_error(sql text, patron text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'SE ESPERABA ERROR "%" y no ocurrió: %', patron, sql;
exception when others then
  if sqlerrm like 'SE ESPERABA%' or position(lower(patron) in lower(sqlerrm)) = 0 then
    raise exception 'Error inesperado para [%]: %', sql, sqlerrm;
  end if;
end $$;
grant execute on function test.expect_error(text, text) to authenticated, anon;

-- Cambia la identidad simulada (como haría el JWT de Supabase)
create function test.como(p_email text) returns void language plpgsql security definer as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end $$;
grant execute on function test.como(text) to authenticated;

create table test.ids (k text primary key, v uuid);
grant all on test.ids to authenticated;
create function test.id(k text) returns uuid language sql stable as $$ select v from test.ids where ids.k = $1 $$;
grant execute on function test.id(text) to authenticated;
