---
description: Crea una nueva migración SQL de Supabase siguiendo las reglas del proyecto
argument-hint: "<nombre_en_snake_case> <qué debe hacer>"
---
Crea una migración para: $ARGUMENTS

Reglas obligatorias:
- Usa `supabase migration new <nombre>`. **Nunca** edites una migración existente.
- Toda tabla nueva lleva `enable row level security` y sus políticas en el mismo archivo, siguiendo la matriz de roles de `20260925000300_seguridad_rls.sql`. Usa `(select public.has_role(...))` en las políticas.
- Las funciones `security definer` llevan `set search_path = ''` y nombres calificados. Revoca `execute` a `anon`.
- Las vistas se crean `with (security_invoker = true)`.
- Los mensajes de error de los triggers van en español y redactados para el usuario final.
- Recuerda que en triggers BEFORE las columnas generadas llegan NULL.

Después de crearla:
1. `supabase db reset` para aplicarla.
2. Añade casos a `tests/test_reglas_negocio.sql` (o crea un archivo nuevo de pruebas y agrégalo a `tests/run.sh`) y ejecuta `./tests/run.sh`.
3. `supabase gen types typescript --local > src/types/database.ts`.
4. Si cambia el modelo de datos, actualiza SPEC.md §5 y, si aplica, §6.
