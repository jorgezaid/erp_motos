# CLAUDE.md — ERP Vehículos Eléctricos

Sistema ERP/CRM para una importadora peruana de motos, bicimotos y trimotos eléctricas: importación → costeo →
taller → precios → ventas → garantías. Idioma del negocio y de la UI: **español (Perú)**.

## Documentos clave (léelos antes de trabajar)
- `SPEC.md`: qué construir. Reglas de negocio **RN-xx**, algoritmo de prorrateo (§7) y pantallas (§10). Lee solo la sección relevante para la tarea.
- `PROGRESS.md`: estado actual y próxima tarea (se importa abajo).
- `supabase/migrations/`: **fuente de verdad del esquema**.

@PROGRESS.md

## Stack
Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind + shadcn/ui · Supabase (Postgres 15+, Auth, RLS) ·
decimal.js · zod · react-hook-form · TanStack Table · Vitest · Playwright · pnpm

## Comandos
```bash
pnpm dev                    # servidor de desarrollo
pnpm test                   # Vitest (unitarias)
pnpm lint && pnpm typecheck # antes de dar una tarea por terminada
./tests/run.sh              # pruebas SQL de reglas de negocio (requiere `supabase start`)
supabase start | stop       # BD local (Docker)
supabase db reset           # re-aplica migraciones + seed en local
supabase migration new <nombre>
supabase gen types typescript --local > src/types/database.ts
```

## Reglas de trabajo
1. **Una tarea de PROGRESS.md a la vez.** Antes de escribir código, propón un plan breve. Al terminar, ejecuta las pruebas y marca la tarea en PROGRESS.md.
2. **Nunca edites una migración existente.** Crea una nueva con `supabase migration new`, y después: `supabase db reset` → `./tests/run.sh` → regenerar los tipos.
3. **La BD es la autoridad.** Las reglas RN-xx ya están en triggers: no las dupliques en el frontend salvo como validación de UX (zod). Los mensajes de error de los triggers ya están en español para el usuario final: muéstralos tal cual.
4. **Dinero con `decimal.js`**, nunca con `number` en cálculos que suman o prorratean. Formato: `S/ 1 234.56`.
5. **Seguridad:**
   - La `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor, y solo si es imprescindible. Por defecto, usa el cliente con el JWT del usuario.
   - Los costos (`import_batches`, `batch_items`, `batch_model_costs`, `v_vehicle_costs`, `v_price_matrix`, `v_sales_margin`) son **solo para admin**. Nunca los expongas a otros roles, ni siquiera en props serializadas a Client Components.
   - Toda tabla nueva lleva `enable row level security` y sus políticas en la misma migración.
6. **RLS filtra en silencio**: un UPDATE o DELETE sin permiso devuelve 0 filas, no un error. Comprueba las filas afectadas.
7. **Triggers**: en un BEFORE, las columnas generadas llegan NULL. Las funciones `security definer` llevan `set search_path = ''` y nombres calificados (`public.tabla`).
8. Estado de las unidades: **nunca** pongas `reservado` o `vendido` a mano; se hace agregando la unidad a una orden o confirmándola.
9. Server Components por defecto; las mutaciones van en Server Actions con validación zod.
10. Si algo del SPEC es ambiguo o contradice el código, **pregunta** en vez de suponer, y registra la decisión en PROGRESS.md → Decisiones.

## Convenciones
- Tablas y columnas de la BD en español con snake_case (como ya existen). En TypeScript: identificadores en español para los conceptos de dominio (`calcularProrrateo`, `costoLanding`) y en inglés para lo técnico (`useQuery`, `props`).
- Rutas de la UI en español: `/lotes`, `/taller`, `/ventas`.
- Pruebas junto al código: `archivo.test.ts`. Cita la regla que cubre cada prueba: `it('RN-10: no pasa a tienda sin inspección', …)`.
- Commits en español y en imperativo: `feat(costeo): calcula prorrateo por CBM`.
- Zona horaria del negocio: `America/Lima`. En SQL usa `public.fecha_lima()`.

## Roles (resumen)
`admin`: todo · `tecnico`: inventario, baterías e inspecciones, sin costos ni precios · `vendedor`: stock, precios y sus propias órdenes, sin costos.
Un usuario sin rol no ve nada. Matriz completa: encabezado de `supabase/migrations/20260925000300_seguridad_rls.sql`.
