# ERP Vehículos Eléctricos

> **¿Vas a trabajar con Claude Code?** Empieza por `docs/GUIA-CLAUDE-CODE.md`.
> Documentos del proyecto: `SPEC.md` (qué construir), `PROGRESS.md` (estado) y `CLAUDE.md` (reglas para Claude).

## Arranque rápido (local)

```bash
pnpm install
supabase start          # BD local (Docker); puertos 443xx
supabase db reset       # migraciones + seed + datos demo (supabase/seeds/)
pnpm env:local          # crea .env.local con la URL y la clave anónima locales
pnpm dev                # http://localhost:3000
```

### Usuarios de prueba (solo local)

Los crea `supabase/seeds/01_usuarios_demo.sql` en cada `supabase db reset`. Contraseña de todos: **`Demo1234!`**

| Email | Rol | Para probar |
|---|---|---|
| `admin@demo.pe` | admin | Todo: lotes, costeo, precios, anulaciones, usuarios |
| `tecnico@demo.pe` | tecnico | Registro de unidades, taller e inspecciones (sin costos ni precios) |
| `vendedor@demo.pe` | vendedor | Stock, precios y punto de venta (sin costos) |
| `vendedor2@demo.pe` | vendedor | Que un vendedor no pueda editar órdenes de otro |
| `pendiente@demo.pe` | *(sin rol)* | La pantalla "Tu cuenta espera aprobación" |

Estos usuarios **no** se suben a Supabase Cloud: `supabase db push` no ejecuta los seeds.

### Datos demo (solo local)

`supabase/seeds/02_datos_demo.sql` carga, pasando por todas las reglas de la BD:

- Modelos **DEMO-48** (48V, 4 baterías), **DEMO-60** (60V, 5) y **DEMO-72** (72V, 6).
- Lote **DEMO-LIQ-001**, liquidado: DEMO-48 × 24 y DEMO-72 × 8, con los montos del *golden test* (SPEC §7) × 4
  (mismas proporciones), así que el costo unitario es el del golden test: DEMO-48 = S/ 3 193.24
  (x1 S/ 5 805.89, x3 S/ 4 912.68, x6 S/ 4 435.06) y DEMO-72 = S/ 8 958.29. Tiene 30 unidades listas en
  *Showroom Piérola*, 1 en ensamble y 1 vendida (orden #1, pago mixto, con garantías).
- Lote **DEMO-ALM-002**, en almacén y sin liquidar: DEMO-60 × 5, con 3 unidades en caja y 2 por registrar.

Las pruebas E2E crean sus propios lotes y modelos, pero las de venta consumen unidades de DEMO-LIQ-001
(7 DEMO-48 por corrida). `pnpm e2e:limpio` reinicia la BD local (borra lo que hayas cargado a mano) y corre la suite.

### Pruebas

```bash
pnpm test               # Vitest (unitarias)
pnpm lint && pnpm typecheck
pnpm build
.\tests\run.ps1         # pruebas SQL (Windows; en Linux/macOS: ./tests/run.sh)
pnpm e2e                # Playwright contra la BD local (requiere `supabase db reset` previo)
```

## Fase 1 completada: Base de datos (Supabase / PostgreSQL)

## Contenido

```
supabase/
  migrations/
    20260925000100_esquema.sql         # tipos, tablas, índices
    20260925000200_reglas_negocio.sql  # triggers, máquina de estados, precios, vistas
    20260925000300_seguridad_rls.sql   # Row Level Security por rol
  seed.sql                             # márgenes 45/35/28 % y ubicaciones
tests/
  00_supabase_shim.sql                 # emula auth.* para probar fuera de Supabase
  test_reglas_negocio.sql              # 10 escenarios de negocio y seguridad
  run.sh                               # BD limpia → migraciones → pruebas
```

## Instalación

**Con Supabase CLI** (recomendado):
```bash
supabase init            # si el proyecto aún no existe
# copiar la carpeta supabase/ de este paquete
supabase db reset        # local: aplica migraciones + seed
supabase db push         # remoto
```
**Sin CLI:** pega los 3 archivos de `migrations/` en el SQL Editor, en orden, y luego `seed.sql`.

**Primer administrador:** regístrate en la app y ejecuta
`update public.profiles set rol = 'admin' where id = '<tu-uuid>';`

**Pruebas:** `./tests/run.sh` (usa la BD local de `supabase start` en el puerto 44322; en otro Postgres: `PGHOST=… PGPORT=… ./tests/run.sh`)

## Flujo que impone la base de datos

```
LOTE      en_transito → en_aduanas → en_almacen → liquidado (costos congelados + precios generados)
UNIDAD    en_caja ⇄ en_ensamble ⇄ listo_en_tienda ⇄ reservado → vendido
                         │                 ▲             ▲           ▲
                  baterías completas +     │     agregar a orden   confirmar orden
                  inspección aprobada +    └──── anular orden / quitar de orden
                  ubicación asignada
ORDEN     borrador → confirmada → (anulada, solo admin)
```

## Decisiones respecto a la especificación

| Tema | Especificación | Implementación | Motivo |
|---|---|---|---|
| Gastos fijos | `gastos_operativos_fijos_pen` (1 campo) | `alquiler_periodo_pen` + `sueldos_periodo_pen`; el campo original queda como **columna calculada** | El algoritmo 3.1 los prorratea por separado |
| Gastos de agente | Aparecen en 3.1 pero no en el modelo | `gastos_agente_usd` | Necesario para la fórmula por CBM |
| Impuestos SUNAT | Un solo total | Desglose Ad Valorem / IGV / IPM / Percepción; `impuestos_sunat_pen` es la suma | Ver nota fiscal abajo |
| Baterías por voltaje | Regla de validación | `cantidad_baterias_12v` **se deriva** del voltaje (48→4, 60→5, 72→6) | Imposible registrar un modelo inconsistente |
| Cantidades por lote | No especificado | Tabla `batch_items` (packing list + cantidad DAM) | El prorrateo necesita cantidades antes de registrar seriales |
| `costo_landing_calculado_pen` | En `vehicle_inventory` | En `batch_model_costs` (admin-only), expuesto por la vista `v_vehicle_costs` | Vendedores y técnicos pueden leer inventario pero **nunca** costos |
| `ubicacion` | VARCHAR | Tabla `locations` | Evita "Showroom Pierola" vs "Showroom Piérola" |
| `metodo_pago` | Campo manual | Tabla `payments`; al confirmar se fija solo (`mixto` si hay >1 método) | Cuadre de caja exacto |
| Precio de venta | Fórmula | `price_list` generada al liquidar; admite `precio_manual_pen` para redondeos | El vendedor no puede alterar precios ni el total |

### ⚠️ Nota fiscal: IGV / IPM / Percepción
Si la empresa está en el Régimen General, el IGV, el IPM y la percepción de importación suelen ser **crédito fiscal recuperable**, no costo. Incluirlos en el landing infla el costo cerca de un 18 % del CIF y, con él, todos los precios. La columna `impuestos_recuperables_al_costo` (por defecto `true`, como pide la especificación) permite excluirlos. Conviene validarlo con tu contador.

## Qué garantiza la base de datos (probado)
- Costos, lotes y packing list: **solo admin**. Los usuarios nuevos no ven nada hasta que se les asigna un rol.
- No se registran más unidades que las declaradas en el packing list; VIN, motor y seriales de batería son únicos.
- Una unidad no pasa a tienda sin baterías completas, sin inspección aprobada y sin ubicación asignada.
- Un lote solo se liquida si todos sus modelos tienen costeo con el tipo de cambio vigente. Una vez liquidado queda congelado y se genera la matriz x1/x3/x6.
- Las ventas x3 y x6 exigen un mínimo de unidades, los pagos deben cuadrar al céntimo y al confirmar se crean las garantías (general + baterías).
- Las vistas de auditoría (`v_batch_reconciliation`, `v_sales_margin`) alertan de diferencias entre packing list, DAM y seriales, y muestran el margen real por venta.

## Siguiente paso (Fase 2, detallada en SPEC.md §7)
La función de prorrateo debe **llenar los componentes** de `batch_model_costs` (FOB, fletes, impuestos, alquiler, sueldos, publicidad y armado asignados). El total y el costo unitario los calcula la base de datos. Luego basta con `update import_batches set estado = 'liquidado'` para que se generen los precios.
