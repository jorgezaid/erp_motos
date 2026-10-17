# PROGRESS — Estado del proyecto

> Claude Code lee este archivo al inicio de cada sesión. **Actualízalo al terminar cada tarea** (con `/cerrar-sesion`).
> Leyenda: `[x]` hecho · `[~]` en curso · `[ ]` pendiente · `[!]` bloqueado · `[—]` descartado

## Estado actual
- **Fase activa:** 10 — Gastos (M9): 10.1–10.4 hechas, 10.5 descartada. La fase 9 (producción: 0.5, 9.1–9.4) la hace el dueño del repo
- **Próxima tarea:** ejecutar la E2E de la 10.6 cuando el cliente lo autorice. Fases 3 a 8 y 11.1 completas; ver `docs/INFORME-FINAL.md`
- **BD local:** tiene los datos reales del cliente (lote `117GZH2606089`): **no** ejecutar `supabase db reset`, `pnpm db:demo` ni `pnpm e2e:limpio`
- **Pendiente en producción:** `supabase db push` de la migración `20261015175924_rpc_importar_plantilla`
- **Última actualización:** 2026-10-15

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

## Fase 2 · Motor de costeo (SPEC §7) ✅
- [x] 2.1 Scaffold mínimo de TypeScript: `package.json`, `tsconfig` strict, Vitest y decimal.js — más ESLint 9 (flat) y `src/lib/decimal.ts` (clon half-up); TS 5.9, Vitest 5, Node ≥ 22.12 (ver D11)
- [x] 2.2 `src/lib/costing/prorrateo.ts`: función pura `calcularProrrateo(lote, items) → FilaCosteo[]` — montos como string de 4 decimales; `ErrorProrrateo` con códigos (también `LOTE_INVALIDO` y `LINEA_INVALIDA`); `calcularCostoTotalPen`/`calcularCostoUnitarioPen` replican las columnas generadas
- [x] 2.3 `prorrateo.test.ts`: *golden test* de SPEC §7, 3 invariantes, errores (Σ EXW = 0, sin TC) y prueba de orden de líneas — más residuo ±0.0001 y empate, y propiedades con 200 lotes aleatorios (semilla fija)
- [x] 2.4 Migración `…_rpc_guardar_costeo.sql`: RPC transaccional que vuelve a validar los invariantes en SQL, con prueba en `tests/` — `20260928063742_rpc_guardar_costeo.sql` (security invoker, solo admin, bloquea el lote con `for update`); valida invariantes 1, 2 y el nuevo 4 (proporcionalidad por fila, ver D12); `tests/test_guardar_costeo.sql` (5 bloques); helpers movidos a `tests/01_helpers.sql` y `run.sh` usa una BD limpia por archivo
- [x] 2.5 `src/lib/pricing/precios.ts`: vista previa de la matriz x1/x3/x6 (debe coincidir con `generar_lista_precios`) — `calcularPrecioSugerido` y `calcularMatrizPrecios` (precio manual, utilidad y margen real); `ErrorPrecios` con códigos; coincide con Postgres en 300 casos (`precios.postgres.json`, generado con `setseed(0.42)`) y en el golden test

## Fase 3 · App base (Next.js) ✅
- [x] 3.1 Next.js 15 + Tailwind + shadcn/ui en la raíz del repo (convivir con `supabase/` y `tests/`) — no usar create-next-app sobre la raíz; instalar next/react manualmente e integrar la config existente (`package.json`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`) — Next 15.5, React 19, Tailwind 4, shadcn (radix-nova, 18 componentes); ESLint con `@next/eslint-plugin-next` y react-hooks (D14)
- [x] 3.2 Clientes Supabase (`@supabase/ssr`): browser, server y middleware — `src/lib/supabase/{client,server,middleware,env}.ts` y `src/middleware.ts`; `pnpm env:local` genera `.env.local` solo con valores públicos (D15)
- [x] 3.3 `supabase gen types typescript --local > src/types/database.ts` — también como `pnpm gen:types`; los tres clientes quedan tipados con `Database`
- [x] 3.4 Login, `/pendiente` y middleware de sesión y rol — `lib/roles.ts` (acceso por ruta, probado), `lib/auth.ts` (`exigirRol`), `lib/errores.ts` (mensajes de la BD); usuarios demo (hoy en `supabase/demo/`, D29); Playwright con 4 E2E de login
- [x] 3.5 Layout con sidebar según el rol, `lib/format.ts` (PEN, USD, fechas de Lima) y un toast para los errores de la BD — `components/sidebar.tsx` (menú lateral en móvil), `lib/navegacion.ts`, `lib/etiquetas.ts` (enums en español), `lib/toast.ts` (`avisar`) y sonner en el layout raíz

## Fase 4 · Catálogo y usuarios (M1, M2) ✅
- [x] 4.1 `/admin/usuarios`: asignar rol y activar o desactivar cuentas — RPC `listar_usuarios()` (migración `20261007220653`) y `tests/test_admin_usuarios.sql`; un admin no se quita su rol ni se desactiva (D19); infraestructura de tablas (`lib/tabla.ts`, `components/tabla/*`: búsqueda, filtros, paginación de 50 y CSV)
- [x] 4.2 `/admin/modelos`: CRUD con la cantidad de baterías derivada — esquemas zod compartidos (`lib/esquemas/`), componentes de formulario y `BotonConfirmar`; solo se ofrecen 48/60/72V y se muestra "5 baterías de 12V" (M2); un modelo usado en lotes no se elimina (se desactiva)
- [x] 4.3 `/admin/ubicaciones` — alta y edición en un diálogo, filtros por estado y tipo, CSV; no se eliminan (se desactivan) porque las unidades y el historial las referencian

## Fase 5 · Lotes de importación (M3) ✅
- [x] 5.1 Listado y creación de lotes — `/lotes` con búsqueda (código, DAM, proveedor), filtro por estado y CSV; diálogo "Nuevo lote" (solo código y proveedor); `/lotes/[id]` con layout y pestañas como subrutas
- [x] 5.2 Pestañas Datos y Costos — en un lote liquidado solo se editan las notas y los costos quedan deshabilitados; vista previa de tributos con el interruptor RN-05 (`lib/costing/impuestos.ts`); migración `20261007223650_invalidar_costeo` + `tests/test_invalidar_costeo.sql` (D21)
- [x] 5.3 Pestaña Packing list — alta, edición y baja de líneas con EXW/CBM precargados del catálogo, totales con decimal.js (`lib/costing/packing.ts`) y alerta packing vs DAM; migración `20261007224356_guard_packing_cantidad` + `tests/test_packing_list.sql` (D23); datos demo (hoy en `supabase/demo/02_datos_demo.sql`, D29)
- [x] 5.4 Pestaña Costeo: vista previa, guardar (RPC 2.4), liquidar y reabrir — tabla de SPEC §7, costo total del lote y precios x1/x3/x6 (con precios manuales); el costeo se recalcula en el servidor al guardar (D24); estado vigente/sin guardar/desactualizado (`lib/costing/estado-costeo.ts`); "Liquidar" exige costeo vigente y confirmación; "Reabrir" también en Costos (M3 ✅)
- [x] 5.5 Pestañas Unidades y Auditoría — Unidades sobre `v_stock` (consulta compartida `lib/consultas/stock.ts`) más el costo landing de `v_vehicle_costs`; Auditoría sobre `v_batch_reconciliation` con filas en rojo y alertas en texto (`lib/auditoria.ts`); ambas con CSV

## Fase 6 · Inventario y taller (M4) ✅
- [x] 6.1 `/inventario` sobre `v_stock` — filtros por estado, modelo, ubicación y color, búsqueda por VIN/motor/modelo y CSV; precios solo para admin y vendedor (nunca costos); se corrigió una carrera en `BarraFiltros` al cambiar dos filtros seguidos
- [x] 6.2 `/inventario/registro`: registro masivo pegando desde Excel o con escáner — parser y validación en `lib/registro.ts` (tab, `;` o `,`; encabezado opcional; RN-03 mayúsculas sin espacios; repetidos); "Faltan X de Y" desde `pendientes_de_registro()`; modo escáner con Enter = siguiente campo; un solo INSERT (todo o nada)
- [x] 6.3 `/taller`: cola móvil — tarjetas de las unidades en caja y en ensamble (baterías x/y e inspección), búsqueda por VIN para el escáner, filtro por estado, CSV; "Iniciar ensamble" (en caja → en ensamble) comprobando filas afectadas
- [x] 6.4 `/taller/[id]`: baterías, inspección y "Pasar a tienda" — N casillas según el voltaje con Enter = siguiente (RN-01/RN-02), quitar serial mal escaneado; checklist (baterías contadas, VIN, motor, frenos, luces, claxon, voltaje) con vista previa aprobada/observada (RN-11, `lib/taller.ts`); "Pasar a tienda" con ubicación, habilitado solo si se cumple RN-10 (M4 ✅)

## Fase 7 · Precios y punto de venta (M5, M6) ✅
- [x] 7.1 `/precios` con vista de admin y vista de vendedor — admin: `v_price_matrix` con costo, precio y utilidad por escala, edición inline del precio manual (marcado "manual", vacío = sugerido) y márgenes globales en % (RN-09); vendedor: modelo, disponibles y x1/x3/x6 leyendo solo `price_list` y `v_stock` (D25); E2E que revisa la red del vendedor (M5 ✅)
- [x] 7.2 `/ventas/nueva`: flujo completo del POS — paso 1 (tipo de venta + cliente con RN-20) crea el borrador (D26); en `/ventas/[id]`: búsqueda por VIN o modelo y color, agregar/quitar (reserva), cambio de escala con re-cotización (RN-13), aviso "Faltan N unidades para precio …", pagos múltiples con saldo siempre visible, confirmar (RN-14/15/16) y eliminar borrador (RN-18); reglas de UX en `lib/ventas.ts` (M6 ✅ x6 con 5 y 2 pestañas)
- [x] 7.3 `/ventas` y `/ventas/[id]`: nota de venta imprimible y anulación — listado con búsqueda (n.º, cliente, documento), filtros por estado y escala, CSV; nota de venta interna (`window.print`, sin sidebar) con unidades, garantías y pagos; editar solo teléfono/email en confirmadas (RN-17); "Anular" solo admin con motivo (unidades a tienda, garantías anuladas)
- [x] 7.5 Escalas activas (D31): `price_margins.activo` (x3 y x6 desactivadas), trigger `guard_escala_activa` (crear, cambiar tipo o confirmar con escala inactiva → error), al menos una activa, y `after_margins_changed` solo con margen o mínimo — migración `20261014065835_escalas_activas` + `tests/test_escalas_activas.sql`; POS solo con escalas activas (sin selector si hay una), `/precios` vendedor sin columnas inactivas (pantalla y CSV), admin con columnas "Desactivada" e interruptor por escala; E2E de x3/x6 activan la escala y la desactivan en `afterEach`
- [x] 7.4 E2E con Playwright: venta x1 con pago mixto y venta x6 — `e2e/venta-completa.spec.ts`; stock demo ampliado (DEMO-48 ×24, DEMO-72 ×8, mismos costos unitarios) y `pnpm e2e:limpio`; suite completa: 38 E2E en verde desde una BD limpia

## Fase 8 · Garantías, auditoría y dashboard (M7, M8) ✅
- [x] 8.1 `/garantias` y reclamos — búsqueda por VIN, DNI, RUC o nombre sobre `v_warranties` (cobertura, vigencia y días restantes), filtro vigentes/vencidas/anuladas y CSV; reclamos: registro (todos los roles, RN-19) y seguimiento (admin/técnico) con diagnóstico y costo; migración `20261007235451_reclamos_estados` + `tests/test_reclamos.sql` (D27)
- [x] 8.2 `/auditoria` y reporte de márgenes — tres vistas (solo admin): conciliación de todos los lotes (filas en rojo, filtro con/sin alertas), margen real por venta y por modelo sobre `v_sales_margin` con rango de fechas de Lima; agregados con decimal.js (`lib/margenes.ts`); CSV de cada vista
- [x] 8.3 Dashboard — indicadores: unidades listas en tienda (y en taller), ventas de hoy y del mes (admin y vendedor), margen real del mes (solo admin, D28); unidades por estado en barras de un tono con valores rotulados y enlace al inventario filtrado; alertas de conciliación (solo admin)

## Fase 9 · Producción
- [ ] 9.1 Deploy en Vercel con las variables de entorno
- [ ] 9.2 Desactivar el registro público en Supabase Auth (solo invitaciones) y crear el primer admin
- [ ] 9.3 Backups y revisión del *Security Advisor* de Supabase
- [ ] 9.4 Carga de los modelos reales (XSDU-17, 23, 24, 25, 29, 31, 35, 36) con sus fichas técnicas

## Fase 10 · Gastos y utilidad neta (M9)
Decisión del cliente: **opción A pura** (D32, RN-22). Los gastos son del negocio y nunca tocan lotes, costeos ni precios.
- [x] 10.1 BD: enums `categoria_gasto` y `estado_gasto`, tabla `gastos` (sin `batch_id`) con RN-21 en CHECK, RLS y grants solo admin; bucket privado `comprobantes-gastos` con políticas en `storage.objects` (RN-24); vista `v_utilidad_mensual` (RN-23); `tests/test_gastos.sql`: RLS (vendedor, técnico y anon no ven gastos ni comprobantes), RN-21, RN-23 y que crear, editar y borrar gastos no cambia `import_batches`, `batch_model_costs` ni `price_list` (RN-22); tipos regenerados — migración `20261015172541_gastos`; `metodo_pago` reutiliza `payment_method` sin `mixto`; un realizado exige fecha y método, un planificado fecha estimada y sin fecha de pago; `creado_por` lo fija un trigger; `tests/00_supabase_shim.sql` emula `storage.buckets/objects` con RLS
- [x] 10.2 `/gastos`: lista con filtros por mes, categoría y estado, totales con decimal.js y exportación a CSV (D34); formulario con subida del comprobante; "Marcar como realizado" con monto real y fecha; sidebar y `lib/roles.ts` solo admin — sin migración nueva; mes por defecto = mes actual de Lima (mes de un gasto = fecha de pago si está realizado, fecha estimada si está planificado); totales realizado/planificado/total y por categoría (`lib/gastos.ts`); alta y edición en un diálogo (`lib/esquemas/gasto.ts`, RN-21) con comprobante PDF/JPG/PNG/WEBP ≤ 5 MB subido por la Server Action a `<gasto_id>/…`, que se abre con una URL firmada de 60 s (`/gastos/[id]/comprobante`); si la subida falla no queda el gasto a medias; reemplazar o quitar el comprobante borra el archivo anterior, y borrar el gasto borra su archivo; "Marcar como realizado" pide monto real, fecha y método (la BD exige los dos últimos)
- [x] 10.3 `/gastos/planificados`: total por mes estimado — una tarjeta por mes (del más próximo al más lejano) con su total y la misma tabla y acciones de `/gastos` (marcar como realizado, editar, borrar); total general en el encabezado; aviso en los meses cuya fecha estimada ya pasó (`agruparPorMesEstimado`)
- [x] 10.4 Utilidad neta del mes en el dashboard (solo admin): ventas − costo landing − gastos realizados — tarjeta con el desglose del mes de Lima sobre `v_utilidad_mensual` (sin fila = todo en cero; la neta se recalcula con decimal.js en `utilidadDelMes`), en rojo si es negativa, y enlace a los gastos realizados del mes; vendedor y técnico no hacen la consulta
- [—] 10.5 ~~`/gastos/importar`~~ **Descartada** (decisión del cliente, D34): los gastos se registran solo desde la app, no por Excel
- [~] 10.6 E2E (`--workers=1`): alta con comprobante, marcar realizado, utilidad neta en el dashboard, vendedor y técnico sin acceso — **escrita, sin ejecutar** (a pedido del cliente, que prueba en local con sus datos reales): `e2e/gastos.spec.ts` (4 pruebas, también editar/borrar y CSV); cada gasto lleva el prefijo `E2E_GASTO` y se borra en `afterAll` con su comprobante. Ejecutar solo `pnpm exec playwright test e2e/gastos.spec.ts` (necesita los usuarios demo); **no** `pnpm e2e:limpio`

## Fase 11 · Importador simple (D33)
- [x] 11.1 `/admin/importar` ("Importar Excel", solo admin, en Administración): sube la plantilla v2 llena (formato exacto), la valida en el servidor (resumen por hoja y errores con hoja y fila) y "Confirmar" la guarda todo o nada — lectura con exceljs (`lib/importar/plantilla.ts`), validación pura (`lib/importar/validar.ts`), RPC `importar_plantilla` (migración `20261015175924_rpc_importar_plantilla` + `tests/test_importar_plantilla.sql`); Usuarios solo se listan; Situación ≠ en_caja es error; reimportar actualiza sin duplicar ni borrar; no costea ni liquida; Vitest con la plantilla real rellenada (`lib/importar/ejemplo.ts`), E2E `e2e/importar.spec.ts`; guía `docs/GUIA-IMPORTAR-EXPORTAR.md`

---

## Fase 12 · Identidad visual de los modelos
- [x] 12.1 Componente `IdentidadModelo` (`components/identidad-modelo.tsx`, lógica en `lib/modelos.ts`): código y nombre comercial, categoría con ícono + texto + color (bicimoto azul/bicicleta, trimoto de pasajeros violeta/personas, trimoto de carga ámbar/camión; contraste AA en claro y oscuro), «60V · 5 baterías» destacado y potencia; tamaños compacto y grande; donde iría la foto va el ícono de la categoría
- [x] 12.2 Taller agrupado por código de modelo, con filtros por modelo y categoría, e identidad grande en `/taller/[id]` — grupos en orden natural (XSDU-9 antes que XSDU-29) con encabezado «XSDU-29 · nombre · 9 en caja · 3 en ensamble» (totales de toda la cola, no de la página); `v_stock` no trae el nombre comercial: se cruza con `vehicle_models` (`lib/consultas/modelos.ts`); filtro `categoria` en `consultarStock` y en el CSV del taller; E2E del taller ajustada (sin ejecutar)
- [ ] 12.3 `IdentidadModelo` en Inventario, Registro de unidades y el buscador de Ventas
- [ ] 12.4 **Pendiente para más adelante** (decisión del cliente): foto del modelo. Migración con `vehicle_models.foto_path` y bucket privado `modelos` (lectura staff, escritura solo admin, RLS y revoke a public/anon), subida en `/admin/modelos` y miniatura en Taller, Inventario y Ventas en lugar del ícono

## Preguntas abiertas (para el dueño del negocio)
1. **IGV, IPM y percepción:** ¿son crédito fiscal (régimen general)? Si lo son, poner `impuestos_recuperables_al_costo = false`; esto baja el costo cerca de un 18 % del CIF. *Consultar con el contador.*
2. ¿Los precios de venta incluyen IGV? (La v1 supone que sí.)
3. ¿Cuántos meses de garantía general y de baterías tiene cada modelo? (Los valores por defecto son 12 y 6.)
4. ¿La escala x3/x6 exige unidades del **mismo modelo** o puede ser mixta? (La v1 permite mezclar modelos.)
5. ¿Se necesitan descuentos a criterio del vendedor? (La v1 no los permite: solo el admin cambia precios.)
6. Datos reales de cada modelo: voltaje, Ah, W, CBM y EXW.

## Pendiente de confirmar con el cliente
Valores por defecto que usa la v1 mientras no se confirmen (todos se cambian sin tocar código, salvo donde se indica):

| Tema | Valor usado en la v1 | Dónde se cambia |
|---|---|---|
| IGV, IPM y percepción como costo (pregunta 1) | Se cargan al costo (`impuestos_recuperables_al_costo = true`) | Interruptor por lote en la pestaña Costos |
| Precios con IGV (pregunta 2) | Sí: los precios de venta incluyen IGV (así se indica en `/precios` y en la nota de venta) | Texto de la UI (no hay cálculo de IGV en ventas) |
| Meses de garantía (pregunta 3) | 12 meses general y 6 de baterías por defecto | Ficha de cada modelo (`/admin/modelos`) |
| Escala x3/x6 con modelos mixtos (pregunta 4) | Se permite mezclar modelos para llegar al mínimo | Regla de la BD (requiere migración) |
| Escalas activas (D31) | Solo x1 activa; x3 y x6 desactivadas (sus precios se siguen generando) | Interruptores en `/precios` (admin) |
| Margen x1 | El cliente indicó 20 % (plantilla v2); en local queda 45 %. El dueño lo fija en producción desde `/precios` | Márgenes globales en `/precios` |
| Descuentos del vendedor (pregunta 5) | No hay: solo el admin cambia precios (precio manual) | — |
| Fichas técnicas reales (pregunta 6) | Solo datos demo (DEMO-48/60/72) | `/admin/modelos` (tarea 9.4) |
| Orden de los pasos del POS (D26) | El cliente se registra en el paso 1, antes de las unidades | Diseño de `/ventas/nueva` |
| Reclamos: diagnóstico obligatorio para aprobar/rechazar (D27) | Sí | Trigger `guard_claim_update` |

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
| D12 | 2026-10-07 | `guardar_costeo` valida además un invariante 4 (SPEC §7): cada fila = total × baseᵢ / Σ bases (±0.01) y armado exacto | Los invariantes 1 y 2 solo miran totales: no detectan un reparto con el criterio equivocado ni montos intercambiados entre modelos |
| D13 | 2026-10-07 | Pruebas SQL: helpers en `tests/01_helpers.sql`; `run.sh` recrea la BD por cada `tests/test_*.sql` | Archivos de prueba independientes entre sí |
| D14 | 2026-10-07 | Tailwind 4 (sin `tailwind.config`) y shadcn con el paquete `cn` (sustituto oficial de clsx + tailwind-merge); `next build` no ejecuta ESLint (`ignoreDuringBuilds`) | El lint ya corre con `pnpm lint` sobre el flat config; Next no detecta el plugin en flat config y lo duplicaría |
| D15 | 2026-10-07 | La app no usa la `SUPABASE_SERVICE_ROLE_KEY` en ningún sitio; `.env.local` solo lleva la URL y la clave anónima | CLAUDE.md regla 5: solo si es imprescindible. Lo administrativo (listar usuarios con email) va por RPC `security definer` que exige admin |
| D16 | 2026-10-07 | Datos y usuarios demo fuera de `seed.sql` (reemplazada por D29) | `tests/run.sh` carga `seed.sql` sobre un `auth.users` simulado sin columnas de contraseña |
| D17 | 2026-10-07 | El acceso por ruta (`lib/roles.ts`) lo aplican el middleware y cada página (`exigirRol`); ruta no permitida → inicio | Defensa en profundidad; la seguridad real sigue siendo el RLS |
| D18 | 2026-10-07 | Playwright se instaló en la 3.4 (no en la 7.4) | Sirve para verificar cada pantalla desde el inicio; la 7.4 agrega los E2E de venta |
| D19 | 2026-10-07 | Un admin no puede quitarse su propio rol de admin ni desactivar su cuenta (trigger `guard_self_profile`); otro admin sí puede | Evita quedarse sin administradores por un clic; es la opción más segura y no contradice el SPEC |
| D20 | 2026-10-07 | Listados: búsqueda, filtros y paginación en el servidor vía la URL (`?q=&estado=&pagina=`); TanStack Table (v8) solo ordena la página visible; CSV por Route Handler `…/csv` con los mismos filtros (máx. 5000 filas, BOM UTF-8, protección contra fórmulas) | SPEC §10/§11; la v9 de TanStack cambió la API |
| D21 | 2026-10-07 | Si cambian los montos o el TC de un lote, o su packing list (cantidad, EXW, CBM), un trigger borra el costeo guardado | RN-07 solo compara cantidad y TC: sin esto se podía liquidar con un costeo calculado sobre montos viejos |
| D22 | 2026-10-07 | En Datos, el estado del lote se elige libremente entre en tránsito, en aduanas y en almacén; "liquidado" solo desde la pestaña Costeo | La BD no impone orden entre esos tres estados; es lo más simple y permite corregir errores |
| D23 | 2026-10-07 | La cantidad del packing list no puede bajar de las unidades ya registradas, y el modelo de una línea no se cambia (se quita y se agrega otra) | RN-04 solo se validaba al registrar unidades; sin esto el lote quedaba inconsistente |
| D24 | 2026-10-07 | "Guardar costeo" no recibe filas del navegador: la Server Action relee el lote y el packing list, recalcula con `calcularProrrateo` y llama a `guardar_costeo` | El cliente nunca decide montos; la RPC vuelve a validar en SQL (D7) |
| D25 | 2026-10-07 | En `/precios` del vendedor hay una fila por modelo y lote liquidado (sin mostrar el lote), con su stock disponible; las ramas admin y vendedor son excluyentes en el servidor | Un mismo modelo puede tener precios distintos según el lote; el vendedor no debe ver lotes ni costos |
| D26 | 2026-10-07 | POS: los datos del cliente se piden en el paso 1 (con el tipo de venta), antes de agregar unidades; el resto del flujo (unidades, pagos, confirmar) ocurre en `/ventas/[id]` sobre la orden en borrador | En la BD una unidad se reserva al agregarla a una orden, y la orden exige cliente con documento válido (CHECK). Así la reserva es inmediata y "dos pestañas, misma unidad" lo resuelve la BD |
| D27 | 2026-10-07 | Reclamos: la BD impone abierto → en revisión → aprobado/rechazado (con diagnóstico) → cerrado; un reclamo nuevo siempre empieza abierto; al pasar a revisión se registra el técnico; uno cerrado no se edita | SPEC M7 define el ciclo pero no había regla en la BD (la BD es la autoridad) |
| D28 | 2026-10-07 | "Margen promedio" del dashboard = margen real ponderado del mes de Lima: Σ utilidad / Σ precio de venta de las unidades vendidas | Coincide con la definición de margen sobre el precio (SPEC §8) y no lo distorsionan las ventas pequeñas |
| D29 | 2026-10-08 | Márgenes y ubicaciones en la migración `20261008041204_datos_base` (idempotente); `seed.sql` queda vacío. Usuarios y stock demo en `supabase/demo/`, fuera de `sql_paths`, cargados solo con `pnpm db:demo` (reset + psql del contenedor local) | `db push` no ejecuta seeds: producción quedaba sin márgenes. Y con los demo en `sql_paths`, `db push --include-seed` podía llevar usuarios con contraseña conocida a producción |
| D30 | 2026-10-13 | Grants explícitos para `authenticated` (CRUD en tablas) y `service_role` (todo), más sus default privileges (migración `20261013160111_grants_roles_api`); nada para `anon`. Además se revoca EXECUTE a `anon` y `PUBLIC` en todas las funciones de `public` y el default de `anon` (`20261013162221_revocar_execute_anon`). `tests/test_grants.sql` exige RLS en todas las tablas, `anon` sin acceso a tablas, secuencias ni funciones, EXECUTE para `authenticated`/`service_role` y que el alta en Auth cree el perfil | Supabase Cloud no da grants por defecto en proyectos nuevos y la app no leía nada. Postgres da EXECUTE a PUBLIC al crear cada función: las creadas después de `seguridad_rls` (is_staff, can_edit_order, de trigger) quedaban ejecutables por `anon`. Ese default de PUBLIC es global: cada migración que cree funciones debe revocarlo (la prueba lo detecta) |

| D31 | 2026-10-14 | Escalas activas: `price_margins.activo`; x3 y x6 nacen desactivadas. Trigger `guard_escala_activa` (BEFORE INSERT/UPDATE en `sales_orders`) rechaza crear, cambiar el tipo o confirmar con una escala inactiva, con un mensaje que nombra las activas; no bloquea anular ni editar el contacto. `generar_lista_precios` sigue generando las 3 escalas; `after_margins_changed` pasa a `after update of margen_objetivo, cantidad_minima`. Debe quedar al menos una escala activa | El negocio vende solo por unidad por ahora; al reactivar una escala ya hay precios, y activar o desactivar no regenera los precios de todos los lotes |
| D32 | 2026-10-15 | Gastos, opción A pura (RN-22): un gasto es siempre del negocio. `gastos` no tiene `batch_id`, ningún trigger de gastos escribe en `import_batches` ni en `batch_model_costs`, y no se invalidan costeos. Utilidad neta del mes = ventas confirmadas − costo landing de lo vendido − **todos** los gastos realizados del mes (RN-23). Se descartó "cargar a lote" | Decisión del cliente. Mantiene el costo landing y los precios independientes de los gastos, y evita contar un gasto dos veces (en el costo de las motos y en la utilidad) |
| D33 | 2026-10-15 | Importador simple: un lote por archivo, formato exacto de la plantilla v2 (se rechaza si cambian hojas o encabezados). Se ignora la fila 2 solo si es gris (EJEMPLO) y no se leen las celdas verdes. Cada fila se busca por su clave (nombre de ubicación sin distinguir mayúsculas, código de modelo, código de embarque, modelo del lote, VIN, serial); se actualiza solo si cambió; lo ausente no se borra y una celda vacía conserva el valor. EXW de la línea = factura o catálogo, y CBM = catálogo (como las columnas verdes). Las filas de Modelos solo con el código se ignoran. Usuarios no crea cuentas. Al confirmar, la Server Action vuelve a leer y validar el mismo archivo (como D24) y llama a la RPC `importar_plantilla` (security invoker, solo admin), que traduce los errores a "Hoja «X», fila N: …". Body de Server Actions: 6 MB (archivo ≤ 5 MB) | Pedido del cliente ("importador SIMPLE"; se descartó la Fase 11 completa). La BD sigue siendo la autoridad: la RPC respeta todos los triggers |
| D34 | 2026-10-15 | Gastos: la lista se exporta a CSV (no .xlsx), con los mismos filtros, como el resto de la app; se descarta `/gastos/importar` (10.5): los gastos se registran solo desde la app. El filtro de mes parte del mes actual de Lima y ofrece "Todos los meses" | Decisión del cliente. Reutiliza la exportación CSV existente (D20) y evita una segunda vía de alta con su propia validación |
| D35 | 2026-10-16 | Borradores de venta: con un documento válido, "Nueva venta" busca las órdenes del cliente (mismo tipo y n.º). Si tiene un borrador, lo avisa con su antigüedad y motos reservadas; "Continuar esa orden" solo aparece si el usuario puede editarla (admin: todas; vendedor: las suyas, como `can_edit_order`). El borrador de otro vendedor se avisa sin botón y no bloquea crear otra orden. Se autocompletan nombre, teléfono y email de la venta más reciente no anulada, solo en campos vacíos. En `/ventas`, "Mis borradores" = `?estado=borrador&mios=1` (vendedor_id = usuario) | Decisión del cliente. El vendedor ya lee todas las órdenes (RLS), así que no hizo falta migración; antigüedad y motos reservadas sirven para detectar borradores olvidados que bloquean stock |

## Problemas conocidos / deuda técnica
- En Supabase, RLS filtra en silencio los UPDATE y DELETE sin permiso (devuelven 0 filas, no un error). La UI debe comprobar el número de filas afectadas.
- En un trigger BEFORE, las columnas generadas llegan nulas: tenerlo en cuenta en futuros triggers (ya se corrigió en `guard_batch_update`).
- Guardar los márgenes globales (`/precios`) son 3 UPDATE separados: si uno fallara a mitad, quedarían mezclados. Los valores se validan antes (riesgo bajo); la solución definitiva es una RPC transaccional.
- Con RLS, Postgres no incluye el valor duplicado en los errores de clave única: los mensajes dicen "El VIN ya está registrado." sin el valor.
- Los E2E de venta consumen stock demo (7 DEMO-48 por corrida, hay 24): `pnpm e2e:limpio` (vía `pnpm db:demo`) lo restaura borrando la BD local.
- Las listas grandes (CSV, precios, márgenes) se cortan en 5000 filas (`MAX_FILAS_CSV`); `/admin/usuarios`, `/precios` y `/auditoria` filtran en el servidor de Next sobre ese tope en vez de paginar en la BD.

## Bitácora de sesiones
| Fecha | Sesión | Resultado |
|---|---|---|
| 2026-09-25 | Claude (chat) | Fase 1 completa: 3 migraciones, seed y suite SQL. Se corrigió un bug en la transición reservado → vendido. Se crearon SPEC, PROGRESS, CLAUDE.md y los comandos. |
| 2026-09-26 | Claude Code | Fase 0.2–0.4: pnpm 10, Supabase CLI, `supabase init/start/db reset`, `.gitattributes` (LF), `tests/run.ps1`; suite SQL 10/10 en PG 17. Tarea 2.1: scaffold TS (Vitest, ESLint 9, decimal.js); test, lint y typecheck en verde. |
| 2026-09-28 | Claude Code | Tareas 2.2 y 2.3: `calcularProrrateo` (SPEC §7) con TDD; golden test, invariantes, residuo, errores y 200 lotes aleatorios. 22 pruebas en verde. |
| 2026-10-07 | Claude Code | Tarea 2.4: RPC `guardar_costeo` con invariantes 1, 2 y 4 en SQL; suites SQL 2/2 archivos en verde (`run.ps1`), Vitest 22/22, lint y typecheck limpios. Tipos de Supabase aún no generados (tarea 3.3). |
| 2026-10-07 | Claude Code | Tarea 2.5: vista previa de precios x1/x3/x6, verificada contra 300 casos de Postgres. Vitest 33/33, lint y typecheck limpios. Fase 2 completa. |
| 2026-10-07 | Claude Code (autónomo) | Fases 3 a 8 (tareas 3.1–8.3), un commit por tarea; 4 migraciones nuevas (listar_usuarios, invalidar_costeo, guard_packing_cantidad, reclamos_estados) con sus pruebas SQL; usuarios y datos demo; revisión del conjunto aplicada. Vitest 148/148, SQL 6/6 archivos, Playwright 45/45, lint, typecheck y build en verde. Informe: `docs/INFORME-FINAL.md`. |
| 2026-10-15 | Claude Code | Tarea 7.5: escalas activas (D31), migración `escalas_activas` con su prueba SQL; POS y `/precios` solo con escalas activas. Vitest 153/153, SQL 8/8 archivos, Playwright 48/48 (`--workers=1`), lint y typecheck en verde. |
| 2026-10-15 | Claude Code | Se revisó la migración `gastos`: sin `batch_id` ni triggers sobre lotes (opción A pura, sin cambios). Tarea 11.1: importador simple (D33). Vitest 180/180, SQL 10/10 archivos, Playwright 50/50 (`--workers=1`, BD limpia), lint, typecheck y build en verde. |
| 2026-10-15 | Claude Code | BD local limpiada de datos demo/E2E (quedan los importados por el cliente). Tareas 10.2–10.4 (un commit cada una), D34 (CSV, 10.5 descartada) y E2E de la 10.6 escrita sin ejecutar. Vitest 205/205, SQL 10/10 archivos, lint, typecheck y build en verde; sin migraciones nuevas. |
| 2026-10-15 | Claude Code | POS (`/ventas/[id]`): ejemplo «XSDU-29 gris», aviso con enlace a `/taller` si no hay ninguna unidad lista en tienda, búsqueda sin distinguir mayúsculas ni tildes (`filtrarUnidades` en `lib/ventas.ts`, filtrada en el servidor de Next, sin migración). Vitest 210/210, lint y typecheck en verde. |
| 2026-10-16 | Claude Code | Ventas sin borradores duplicados (D35): en "Nueva venta", aviso del borrador del cliente con "Continuar esa orden" y autocompletado desde su venta más reciente; en `/ventas`, "Continuar", antigüedad y motos reservadas en los borradores y el filtro "Mis borradores"; aviso "Tienes N ventas en borrador" en el Inicio. Sin migración. Vitest 219/219, SQL 10/10 archivos, lint y typecheck en verde. |
