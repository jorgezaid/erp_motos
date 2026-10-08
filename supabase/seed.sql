-- Seed de Supabase (lo ejecuta `supabase db reset`). Se deja vacío a propósito (D29):
--   · Los datos base (márgenes y ubicaciones) están en la migración `…_datos_base.sql`,
--     así llegan también a producción con `supabase db push`.
--   · Los usuarios y datos demo están en supabase/demo/ y SOLO se cargan en local con
--     `pnpm db:demo` (ningún comando de la CLI los conoce, ni `db push --include-seed`).
--
-- Los modelos reales (XSDU-29, XSDU-31, ...) se cargan desde la app con sus fichas técnicas.
-- Primer administrador: tras registrarse en Supabase Auth, ejecutar
--   update public.profiles set rol = 'admin' where id = '<uuid-del-usuario>';
select 1;
