# PROGRESS — Estado del proyecto

> Claude Code lee este archivo al inicio de cada sesión. **Actualízalo al terminar cada tarea** (con `/cerrar-sesion`).
> Leyenda: `[x]` hecho · `[~]` en curso · `[ ]` pendiente · `[!]` bloqueado

## Estado actual
- **Fase activa:** 2 — Motor de costeo
- **Próxima tarea:** 2.2 (prorrateo); pendiente de la Fase 0: 0.5 (Supabase Cloud)
- **Última actualización:** 2026-09-26

---

## Fase 0 · Preparación del entorno
- [x] 0.1 Crear el repositorio git, hacer el primer commit con esta carpeta y subirlo a GitHub — privado: `jorgezaid/erp_motos`
- [x] 0.2 Instalar Node 22.12+, pnpm, Docker y Supabase CLI (ver `docs/GUIA-CLAUDE-CODE.md`) — pnpm 10 (la 12 es binaria y la bloqueaba Smart App Control)
- [x] 0.3 `supabase init` (conservando `supabase/migrations` y `seed.sql`) + `supabase start` — puertos locales 443xx (ver D8)
- [x] 0.4 `./tests/run.sh` pasa contra la BD local de Supabase — en Windows: `.\tests\run.ps1` (psql dentro del contenedor)
- [ ] 0.5 Crear el proyecto en Supabase Cloud, `supabase link` y `supabase db push`

## Fase 1 · Base de datos ✅
- [x] 1.1 Tipos, tablas e índices (`20260925000100_esquema.sql`)
- [x] 1.2 Reglas de negocio, máquinas de estado y vistas (`20260925000200_reglas_negocio.sql`)
- [x] 1.3 RLS por rol (`20260925000300_seguridad_rls.sql`)
- [x] 1.4 Seed: márgenes 45/35/28 y ubicaciones
- [x] 1.5 Suite SQL con 10 escenarios (`tests/test_reglas_negocio.sql`): todos pasan en PostgreSQL 16

## Fase 2 · Motor de costeo (SPEC §7)
- [x] 2.1 Scaffold mínimo de TypeScript: `package.json`, `tsconfig` strict, Vitest y decimal.js — más ESLint 9 (flat) y `src/lib/decimal.ts` (clon half-up); TS 5.9, Vitest 5, Node ≥ 22.12 (ver D11)
- [ ] 2.2 `src/lib/costing/prorrateo.ts`: función pura `calcularProrrateo(lote, items) → FilaCosteo[]`
- [ ] 2.3 `prorrateo.test.ts`: *golden test* de SPEC §7, 3 invariantes, errores (Σ EXW = 0, sin TC) y prueba de orden de líneas
- [ ] 2.4 Migración `…_rpc_guardar_costeo.sql`: RPC transaccional que vuelve a validar los invariantes en SQL, con prueba en `tests/`
- [ ] 2.5 `src/lib/pricing/precios.ts`: vista previa de la matriz x1/x3/x6 (debe coincidir con `generar_lista_precios`)

## Fase 3 · App base (Next.js)
- [ ] 3.1 Next.js 15 + Tailwind + shadcn/ui en la raíz del repo (convivir con `supabase/` y `tests/`) — no usar create-next-app sobre la raíz; instalar next/react manualmente e integrar la config existente (`package.json`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`)
- [ ] 3.2 Clientes Supabase (`@supabase/ssr`): browser, server y middleware
- [ ] 3.3 `supabase gen types typescript --local > src/types/database.ts`
- [ ] 3.4 Login, `/pendiente` y middleware de sesión y rol
- [ ] 3.5 Layout con sidebar según el rol, `lib/format.ts` (PEN, USD, fechas de Lima) y un toast para los errores de la BD

## Fase 4 · Catálogo y usuarios (M1, M2)
- [ ] 4.1 `/admin/usuarios`: asignar rol y activar o desactivar cuentas
- [ ] 4.2 `/admin/modelos`: CRUD con la cantidad de baterías derivada
- [ ] 4.3 `/admin/ubicaciones`

## Fase 5 · Lotes de importación (M3)
- [ ] 5.1 Listado y creación de lotes
- [ ] 5.2 Pestañas Datos y Costos
- [ ] 5.3 Pestaña Packing list
- [ ] 5.4 Pestaña Costeo: vista previa, guardar (RPC 2.4), liquidar y reabrir
- [ ] 5.5 Pestañas Unidades y Auditoría

## Fase 6 · Inventario y taller (M4)
- [ ] 6.1 `/inventario` sobre `v_stock`
- [ ] 6.2 `/inventario/registro`: registro masivo pegando desde Excel o con escáner
- [ ] 6.3 `/taller`: cola móvil
- [ ] 6.4 `/taller/[id]`: baterías, inspección y "Pasar a tienda"

## Fase 7 · Precios y punto de venta (M5, M6)
- [ ] 7.1 `/precios` con vista de admin y vista de vendedor
- [ ] 7.2 `/ventas/nueva`: flujo completo del POS
- [ ] 7.3 `/ventas` y `/ventas/[id]`: nota de venta imprimible y anulación
- [ ] 7.4 E2E con Playwright: venta x1 con pago mixto y venta x6

## Fase 8 · Garantías, auditoría y dashboard (M7, M8)
- [ ] 8.1 `/garantias` y reclamos
- [ ] 8.2 `/auditoria` y reporte de márgenes
- [ ] 8.3 Dashboard

## Fase 9 · Producción
- [ ] 9.1 Deploy en Vercel con las variables de entorno
- [ ] 9.2 Desactivar el registro público en Supabase Auth (solo invitaciones) y crear el primer admin
- [ ] 9.3 Backups y revisión del *Security Advisor* de Supabase
- [ ] 9.4 Carga de los modelos reales (XSDU-17, 23, 24, 25, 29, 31, 35, 36) con sus fichas técnicas

---

## Preguntas abiertas (para el dueño del negocio)
1. **IGV, IPM y percepción:** ¿son crédito fiscal (régimen general)? Si lo son, poner `impuestos_recuperables_al_costo = false`; esto baja el costo cerca de un 18 % del CIF. *Consultar con el contador.*
2. ¿Los precios de venta incluyen IGV? (La v1 supone que sí.)
3. ¿Cuántos meses de garantía general y de baterías tiene cada modelo? (Los valores por defecto son 12 y 6.)
4. ¿La escala x3/x6 exige unidades del **mismo modelo** o puede ser mixta? (La v1 permite mezclar modelos.)
5. ¿Se necesitan descuentos a criterio del vendedor? (La v1 no los permite: solo el admin cambia precios.)
6. Datos reales de cada modelo: voltaje, Ah, W, CBM y EXW.

## Decisiones (ADR resumido)
| # | Fecha | Decisión | Motivo |
|---|---|---|---|
| D1 | 2026-09-25 | Backend en Supabase; la lógica crítica va en triggers de la BD | Una sola fuente de verdad, imposible de saltar desde el cliente |
| D2 | 2026-09-25 | Los costos viven en tablas solo para admin (`batch_model_costs`), no en `vehicle_inventory` | Con RLS no se pueden ocultar columnas; separar las tablas es la forma segura |
| D3 | 2026-09-25 | Se separaron alquiler y sueldos, y se añadió `gastos_agente_usd` | El algoritmo 3.1 original los usa por separado |
| D4 | 2026-09-25 | Tabla `batch_items` (packing list) | El prorrateo necesita cantidades antes de que se registren los seriales |
| D5 | 2026-09-25 | `baterias_esperadas` y `cantidad_baterias_12v` son derivadas | Imposible registrar datos inconsistentes |
| D6 | 2026-09-25 | Los usuarios nuevos no tienen rol | Evita que un registro público obtenga acceso |
| D7 | 2026-09-25 | Prorrateo en TypeScript con decimal.js, con validación final en SQL | Así se hizo el plan por pasos, y la doble verificación evita descuadres |
| D8 | 2026-09-26 | Puertos locales de Supabase 443xx (API 44321, BD 44322, Studio 44323) en vez de 543xx | Windows (Hyper-V/WSL) reserva el rango 54283–54382 y `supabase start` no podía abrir 54322 |
| D9 | 2026-09-26 | `[analytics] enabled = false` en `supabase/config.toml` | En Windows, vector se reinicia en bucle sin acceso al socket de Docker; los logs de Studio no son necesarios en local |
| D10 | 2026-09-26 | `tests/run.ps1` ejecuta el propio `run.sh` dentro del contenedor de la BD (vía `docker cp`) | Sin psql en Windows; una sola lógica de pruebas, y se evita que PowerShell 5.1 dañe el UTF-8 |
| D11 | 2026-09-26 | Node ≥ 22.12 (antes 20+), TypeScript 5.9 y no 7, sin `exactOptionalPropertyTypes` | Vitest 5 exige Node 22.12+ (Node 20 ya no tiene soporte); typescript-eslint solo admite TS < 6.1; `exactOptionalPropertyTypes` choca con los tipos de Supabase y react-hook-form |

## Problemas conocidos / deuda técnica
- En Supabase, RLS filtra en silencio los UPDATE y DELETE sin permiso (devuelven 0 filas, no un error). La UI debe comprobar el número de filas afectadas.
- En un trigger BEFORE, las columnas generadas llegan nulas: tenerlo en cuenta en futuros triggers (ya se corrigió en `guard_batch_update`).

## Bitácora de sesiones
| Fecha | Sesión | Resultado |
|---|---|---|
| 2026-09-25 | Claude (chat) | Fase 1 completa: 3 migraciones, seed y suite SQL. Se corrigió un bug en la transición reservado → vendido. Se crearon SPEC, PROGRESS, CLAUDE.md y los comandos. |
| 2026-09-26 | Claude Code | Fase 0.2–0.4: pnpm 10, Supabase CLI, `supabase init/start/db reset`, `.gitattributes` (LF), `tests/run.ps1`; suite SQL 10/10 en PG 17. Tarea 2.1: scaffold TS (Vitest, ESLint 9, decimal.js); test, lint y typecheck en verde. |
