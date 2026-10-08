# Informe final — Fases 3 a 8 (2026-10-07)

Trabajo autónomo sobre las tareas 3.1 a 8.3 de `PROGRESS.md`: una tarea a la vez, cada una con sus pruebas
y su commit. No se tocaron la 0.5 (Supabase Cloud) ni la Fase 9 (deploy), ni se hizo `git push` o `supabase db push`.

## 1. Lo que se hizo

| Fase | Resultado |
|---|---|
| 3 · App base | Next.js 15.5 + React 19 + Tailwind 4 + shadcn/ui en la raíz; clientes de Supabase (`@supabase/ssr`) tipados; login, `/pendiente` y middleware por rol; layout con sidebar según el rol (con menú lateral en móvil); formatos `S/ 1 234.56`, `US$ 1,234.56` y fechas de Lima; toasts con los mensajes de la BD |
| 4 · Catálogo y usuarios | `/admin/usuarios` (roles y activación), `/admin/modelos` (CRUD, baterías derivadas del voltaje), `/admin/ubicaciones` |
| 5 · Lotes | `/lotes` y `/lotes/[id]` con pestañas Datos, Costos (interruptor RN-05), Packing list, Costeo (tabla de SPEC §7, guardar, liquidar y reabrir), Unidades y Auditoría |
| 6 · Inventario y taller | `/inventario` con filtros; registro masivo pegando desde Excel o con escáner; `/taller` (cola móvil) y `/taller/[id]` (baterías, inspección y "Pasar a tienda") |
| 7 · Precios y ventas | `/precios` (vista de admin con precio manual y márgenes; vista de vendedor sin costos); punto de venta completo; `/ventas` con nota de venta imprimible y anulación |
| 8 · Garantías y reportes | `/garantias` con reclamos y su seguimiento; `/auditoria` (conciliación y margen real por venta y por modelo); dashboard |

Común a todos los listados: búsqueda, filtros, paginación de 50 en el servidor y exportación a CSV (Excel la abre con tildes).
Todas las mutaciones son Server Actions con zod que comprueban las filas afectadas (RLS silencioso).
La app **no usa la `service_role` key**: todo pasa por el JWT del usuario y por el RLS.

### Migraciones nuevas (no se editó ninguna existente)

| Migración | Qué agrega | Prueba |
|---|---|---|
| `20261007220653_rpc_listar_usuarios` | RPC `listar_usuarios()` (email desde `auth.users`, solo admin) y un admin no puede quitarse su rol ni desactivarse | `tests/test_admin_usuarios.sql` |
| `20261007223650_invalidar_costeo` | Si cambian los montos, el TC o el packing list de un lote, se borra su costeo guardado | `tests/test_invalidar_costeo.sql` |
| `20261007224356_guard_packing_cantidad` | La cantidad del packing list no baja de las unidades registradas; el modelo de una línea no se cambia | `tests/test_packing_list.sql` |
| `20261007235451_reclamos_estados` | Ciclo de los reclamos: abierto → en revisión → aprobado/rechazado (con diagnóstico) → cerrado | `tests/test_reclamos.sql` |

### Estado de las pruebas (última corrida)

| Batería | Resultado |
|---|---|
| `pnpm test` (Vitest) | 148/148 en 23 archivos |
| `.\tests\run.ps1` (SQL) | 6/6 archivos |
| `pnpm e2e:limpio` (Playwright) | 45/45, desde una BD limpia |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | Sin errores |

Los criterios de aceptación ✅ de SPEC §10 tienen su prueba E2E: modelo de 36V imposible y "5 baterías de 12V"
(M2); valores exactos de §7 en la pestaña Costeo y "Reabrir lote" tras liquidar (M3); 72V con 6 casillas e
inspección con 5 baterías "Observada" (M4); ningún costo en la red del vendedor (M5); "Faltan 1 unidad para
precio distribuidor" y dos pestañas vendiendo la misma unidad (M6).

## 2. Cómo probarlo paso a paso

### Preparación (una vez)
```powershell
pnpm install
supabase start            # BD local en Docker
supabase db reset         # migraciones + seed + usuarios y datos demo
pnpm env:local            # crea .env.local (URL y clave anónima locales)
pnpm dev                  # abre http://localhost:3000
```

### Usuarios de prueba (contraseña de todos: `Demo1234!`)

| Email | Rol |
|---|---|
| `admin@demo.pe` | admin |
| `tecnico@demo.pe` | técnico |
| `vendedor@demo.pe` | vendedor |
| `vendedor2@demo.pe` | vendedor (para probar órdenes ajenas) |
| `pendiente@demo.pe` | sin rol |

Datos demo: modelos DEMO-48/60/72; lote **DEMO-LIQ-001** liquidado (costo unitario de DEMO-48 = S/ 3 193.24,
x1 = S/ 5 805.89), con 30 unidades en tienda y una venta mixta (#1); lote **DEMO-ALM-002** en almacén con
3 unidades en caja y 2 por registrar.

### Recorrido sugerido
1. **Acceso** — Entra con `pendiente@demo.pe`: verás "Tu cuenta espera aprobación". Sal y entra como
   `admin@demo.pe` → *Usuarios* → asígnale un rol: ya puede entrar. Ojo: tu propio rol no se puede cambiar.
2. **Catálogo** — *Modelos* → *Nuevo modelo*: el voltaje solo ofrece 48/60/72V y al elegir 60V se muestra
   "5 baterías de 12V".
3. **Lote y costeo (admin)** — *Lotes* → *Nuevo lote*. En *Costos* carga el golden test (TC 3.78, FOB 7200,
   flete 800, agente 200, Ad Valorem 500, IGV 1000, IPM 200, percepción 300, flete nacional 400, alquiler 1000,
   sueldos 2000, publicidad 200). En *Packing list* agrega DEMO-48 × 6 y DEMO-72 × 2. En *Costeo* verás
   la tabla de SPEC §7 con S/ 3 193.24 y S/ 8 958.29 y el total S/ 37 076.00. *Guardar costeo* → *Liquidar lote*:
   los costos quedan bloqueados y aparece *Reabrir lote*. Prueba a cambiar un monto antes de liquidar: el costeo
   guardado se descarta y hay que guardarlo de nuevo.
4. **Registro y taller (técnico, mejor en el celular)** — Entra como `tecnico@demo.pe` → *Registro de unidades*
   → elige "DEMO-ALM-002 · DEMO-60" (faltan 2 de 5) y pega desde Excel dos filas `VIN<tab>motor<tab>color`.
   En *Taller* busca una unidad, *Iniciar ensamble* → *Baterías e inspección*: escanea los seriales (Enter
   pasa a la siguiente casilla), registra una inspección y elige la ubicación: *Pasar a tienda* se habilita solo
   cuando se cumple RN-10. Nota: esas unidades no se pueden vender porque DEMO-ALM-002 no está liquidado (RN-12).
5. **Precios** — Como admin, en *Precios* edita el precio x1 de DEMO-48 (queda marcado "manual") o cambia un
   margen: se recalculan los precios. Como vendedor, la misma pantalla muestra solo modelo, stock y precios.
6. **Venta (vendedor)** — *Ventas* → *Nueva venta* → escala y cliente (prueba un RUC inválido) → busca
   "DEMO-48" → agrega unidades → registra un pago en efectivo y otro con tarjeta (el saldo pendiente siempre se
   ve) → *Confirmar venta*. La nota de venta muestra el pago mixto y las garantías; *Imprimir* oculta el menú.
   Con escala x6 y 5 unidades verás "Faltan 1 unidad para precio distribuidor".
7. **Anulación (admin)** — Abre la venta y pulsa *Anular* (el motivo es obligatorio): la unidad vuelve a tienda
   y las garantías quedan anuladas.
8. **Garantías** — Busca el DNI `45678912` (venta demo #1): verás la cobertura y los días restantes.
   *Registrar reclamo* (cualquier rol) y, como técnico, *Atender*: revisión → aprobar (pide diagnóstico) → cerrar.
9. **Auditoría y dashboard (admin)** — *Auditoría* marca en rojo DEMO-ALM-002 (faltan unidades y baterías) y
   muestra el margen real por venta y por modelo (CSV en cada vista). El inicio muestra los indicadores.

### Pruebas automáticas
```powershell
pnpm test; pnpm lint; pnpm typecheck; pnpm build
.\tests\run.ps1           # pruebas SQL (crea una BD aparte, no toca la de desarrollo)
pnpm e2e:limpio           # ATENCIÓN: reinicia la BD local y corre los 45 E2E
```

## 3. Decisiones tomadas (detalle en PROGRESS → Decisiones)

| # | Decisión |
|---|---|
| D14 | Tailwind 4 y shadcn con el paquete `cn`; `next build` no repite el lint |
| D15 | La app nunca usa la `service_role` key; `.env.local` solo lleva valores públicos |
| D16 | Usuarios y datos demo en `supabase/seeds/` (no en `seed.sql`, que usan las pruebas SQL) |
| D17 | Acceso por ruta en el middleware **y** en cada página (`exigirRol`); el RLS sigue siendo la seguridad real |
| D18 | Playwright desde la 3.4 para verificar cada pantalla |
| D19 | Un admin no puede quitarse su rol ni desactivarse (lo hace otro admin) |
| D20 | Listados con filtros en la URL, paginación en el servidor y CSV por Route Handler (máx. 5000 filas) |
| D21 | Cambiar montos o packing list borra el costeo guardado (evita liquidar con costos viejos) |
| D22 | En Datos el estado del lote se elige entre los tres previos; "liquidado" solo desde Costeo |
| D23 | El packing list no baja de las unidades registradas; el modelo de una línea no se cambia |
| D24 | "Guardar costeo" recalcula en el servidor: el navegador no envía montos |
| D25 | El vendedor ve una fila de precios por modelo y lote, sin ver el lote ni costos |
| D26 | POS: el cliente se registra en el paso 1 (la reserva exige una orden con cliente válido) |
| D27 | Reclamos con máquina de estados en la BD y diagnóstico obligatorio para aprobar o rechazar |
| D28 | "Margen promedio" = margen ponderado del mes (Σ utilidad / Σ venta) |

## 4. Pendiente de confirmar con el cliente

La v1 usa estos valores por defecto (tabla completa en PROGRESS → "Pendiente de confirmar con el cliente"):

1. **IGV, IPM y percepción**: hoy se cargan al costo. Si la empresa los usa como crédito fiscal, hay que apagar
   el interruptor RN-05 en cada lote (el costo baja cerca de un 18 % del CIF). *Consultar con el contador.*
2. **Precios con IGV**: se asume que sí (así lo dicen `/precios` y la nota de venta).
3. **Meses de garantía**: 12 general y 6 de baterías por defecto, editables por modelo.
4. **x3/x6 con modelos mezclados**: permitido.
5. **Descuentos del vendedor**: no existen; solo el admin fija precios manuales.
6. **Fichas técnicas reales** (voltaje, Ah, W, CBM, EXW) de los modelos XSDU: falta cargarlas (tarea 9.4).
7. **Orden del POS** (D26) y **diagnóstico obligatorio** en reclamos (D27): validar que encajan con la operación.

## 5. Problemas conocidos

- **Márgenes globales**: se guardan con 3 UPDATE separados; si uno fallara a mitad quedarían mezclados (los
  valores se validan antes; la solución definitiva es una RPC transaccional).
- **Errores de duplicado**: con RLS, Postgres no incluye el valor repetido; el mensaje dice "El VIN ya está
  registrado." sin el valor.
- **Stock demo y E2E**: los E2E de venta consumen 7 DEMO-48 por corrida (hay 24); `pnpm e2e:limpio` lo restaura,
  pero **borra lo que hayas cargado a mano** en la BD local.
- **Tope de 5000 filas** en exportaciones y en `/precios`, `/auditoria` y `/admin/usuarios`, que filtran sobre ese
  tope en el servidor de Next en vez de paginar en la BD. Suficiente para el volumen esperado; revisar si crece.
- **"Ventas de hoy"** del dashboard depende de la fecha de `supabase db reset`: la venta demo #1 se confirma al
  cargar los datos.
- `supabase gen types` escribe `src/types/database.ts` sin formato (la CLI no encontró prettier); es válido.
- Sin facturación SUNAT (fuera de alcance de la v1): la nota de venta es interna.

## 6. Siguientes pasos (para el dueño del repo)

1. Revisar y hacer `git push` de los commits locales.
2. 0.5: crear el proyecto en Supabase Cloud, `supabase link` y `supabase db push` (los seeds demo **no** se suben).
3. 9.1–9.3: deploy en Vercel con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (no hace falta
   la `service_role`), desactivar el registro público, crear el primer admin y revisar el *Security Advisor*.
4. Responder las preguntas de la sección 4.
