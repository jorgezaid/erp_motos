# SPEC — ERP de Vehículos Eléctricos (Importación → Almacén → Ensamble → Precios → Ventas)

> **Fuente de verdad funcional del proyecto.** Si el código y este documento difieren, gana este documento, salvo en el
> esquema de datos: allí mandan las migraciones en `supabase/migrations/`. Todo cambio de alcance se registra
> primero aquí y en la sección *Decisiones* de `PROGRESS.md`.
>
> Versión 1.0 · 2026-09-25 · Documento de origen: `docs/especificacion-original.md`

---

## 1. Visión y alcance

Plataforma web interna para una importadora peruana de vehículos eléctricos (bicimotos, trimotos de pasajeros y
trimotos de carga). Cubre el ciclo de vida completo de cada **lote de importación** (contenedor):

1. Registro de los costos de importación y de la logística nacional, y su **prorrateo automático** por modelo (costo landing).
2. Control de inventario **por número de serie**: VIN de chasis, número de motor y seriales de batería.
3. Ensamble e **inspección técnica** obligatoria antes de exhibir cada unidad.
4. **Matriz de precios** automática por escala de venta (x1, x3, x6).
5. **Punto de venta**: órdenes, pagos (incluido el mixto) y confirmación.
6. **Garantías** y reclamos postventa.
7. **Auditoría**: packing list vs. DAM vs. seriales, y margen real por venta.

### Fuera de alcance (v1)
- Facturación electrónica SUNAT (boletas y facturas). El sistema emite solo una **nota de venta interna**; la integración con un OSE/PSE queda para la v2.
- Contabilidad general, planillas y cuentas por pagar.
- Ventas a crédito o en cuotas: en v1 toda venta se paga completa al confirmarse.
- Multi-empresa y multi-moneda en ventas: se vende solo en PEN.

---

## 2. Glosario

| Término | Significado |
|---|---|
| **EXW** | *Ex Works*: precio unitario del proveedor en fábrica (USD). Base del prorrateo por valor. |
| **FOB** | *Free On Board*: valor de la mercadería puesta en el barco (USD). |
| **CBM** | Metros cúbicos que ocupa cada unidad embalada. Base del prorrateo por volumen. |
| **DAM** | Declaración Aduanera de Mercancías (SUNAT). Ej.: `118-2026-10-361056-01-0-00`. |
| **Packing list** | Lista del proveedor con modelos, cantidades y (a veces) VINs de cada contenedor. |
| **Landing cost** | Costo total de una unidad puesta en el almacén y lista para vender (PEN). |
| **Liquidar un lote** | Cerrar sus costos: se congela el costeo y se genera la matriz de precios. |
| **Ad Valorem / IGV / IPM / Percepción** | Tributos de importación. IGV + IPM + percepción suelen ser crédito fiscal (ver RN-05). |

---

## 3. Usuarios y roles

| Rol | Quién | Puede |
|---|---|---|
| `admin` | Gerencia / administración | Todo. Es el único que ve costos, lotes y márgenes, liquida lotes, ajusta precios, anula ventas confirmadas y asigna roles. |
| `tecnico` | Técnico ensamblador | Registrar unidades (VIN y motor) y seriales de batería, mover unidades entre caja, ensamble y tienda, registrar inspecciones y atender reclamos. **No ve costos ni precios.** |
| `vendedor` | Asesor de ventas | Ver stock y precios, crear órdenes, registrar pagos, confirmar sus propias ventas y registrar reclamos. **No ve costos.** |
| *(sin rol)* | Usuario recién registrado | Nada, hasta que un admin le asigne un rol. |

La matriz detallada por tabla está en el encabezado de `supabase/migrations/20260925000300_seguridad_rls.sql`.
**La seguridad se aplica con RLS en la base de datos**; ocultar botones en la UI es solo una cuestión de experiencia de usuario, no de seguridad.

---

## 4. Arquitectura y stack

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | **Next.js 15 (App Router) + React 19 + TypeScript `strict`** | Server Components por defecto; Client Components solo donde haya interacción. |
| UI | **Tailwind CSS + shadcn/ui** | Tablas con TanStack Table; formularios con react-hook-form + zod. |
| Backend | **Supabase**: PostgreSQL 15+, Auth y RLS | La lógica crítica vive en la BD (triggers y RPC). Next.js usa Server Actions para las mutaciones. |
| Cálculos de dinero | **decimal.js** | Prohibido usar `number` de JS en montos monetarios que se sumen o se prorrateen. |
| Pruebas | Vitest (unitarias), SQL (`tests/run.sh`) y Playwright (E2E, a partir de la fase 7) | |
| Hosting | Vercel (frontend) + Supabase Cloud | |

### Estructura de carpetas (objetivo)

```
.
├── CLAUDE.md                 # Instrucciones para Claude Code
├── SPEC.md                   # Este documento
├── PROGRESS.md               # Estado del proyecto y bitácora
├── docs/                     # Especificación original y guías
├── supabase/
│   ├── migrations/           # NUNCA editar una migración ya aplicada: crear una nueva
│   └── seed.sql
├── tests/                    # Pruebas SQL de reglas de negocio
└── src/
    ├── app/
    │   ├── (auth)/login/
    │   └── (app)/            # Layout con sidebar; protegido por middleware
    │       ├── page.tsx      # Dashboard
    │       ├── lotes/        # M3
    │       ├── inventario/   # M4
    │       ├── taller/       # M4
    │       ├── precios/      # M5
    │       ├── ventas/       # M6
    │       ├── garantias/    # M7
    │       ├── auditoria/    # M8
    │       └── admin/        # M1-M2: usuarios, modelos, ubicaciones
    ├── components/ui/        # shadcn
    ├── components/           # componentes de dominio
    ├── lib/
    │   ├── supabase/         # client.ts, server.ts, middleware.ts
    │   ├── costing/          # prorrateo.ts + prorrateo.test.ts  (Fase 2)
    │   ├── pricing/          # precios.ts (vista previa de la matriz)
    │   └── format.ts         # formatPEN, formatUSD, fechas es-PE
    └── types/database.ts     # generado: supabase gen types typescript
```

---

## 5. Modelo de datos (resumen)

La **fuente de verdad** son las migraciones. Resumen de entidades:

| Tabla | Propósito | Acceso |
|---|---|---|
| `profiles` | Usuario ↔ rol | todos (lectura) |
| `locations` | Almacén Central, Showroom Piérola, Taller… | staff lee; admin escribe |
| `vehicle_models` | Catálogo: voltaje, baterías (derivadas), Ah, W, CBM, EXW, meses de garantía | staff lee; admin escribe |
| `import_batches` | Lote o contenedor con todos sus costos y su estado | **solo admin** |
| `batch_items` | Packing list: modelo, cantidad en el packing list, cantidad en la DAM, EXW y CBM (snapshot) | **solo admin** |
| `batch_model_costs` | Resultado del prorrateo por modelo (componentes → total → unitario) | **solo admin** |
| `price_margins` | Márgenes x1 = 45 %, x3 = 35 %, x6 = 28 % y cantidades mínimas | staff lee; admin edita |
| `price_list` | Precio por lote + modelo + escala (sugerido y manual) | admin y vendedor |
| `vehicle_inventory` | Unidad física: VIN, motor, colores, estado y ubicación | staff lee; admin/técnico escriben |
| `vehicle_batteries` | Seriales de las baterías de 12V de cada unidad | staff lee; admin/técnico escriben |
| `technical_inspections` | Inspección: baterías contadas, VIN/motor verificados, checklist → `aprobada` | staff lee; admin/técnico crean |
| `vehicle_status_history` | Trazabilidad de estados y ubicaciones | staff lee (lo escribe un trigger) |
| `sales_orders` | Orden de venta: cliente, tipo de venta, total, estado y método de pago | staff lee; admin/vendedor dueño escriben |
| `order_items` | Unidades de la orden (el precio lo fija el sistema) | se crean y borran; nunca se actualizan |
| `payments` | Pagos: efectivo, transferencia o tarjeta | ídem |
| `warranties` | Garantía general + garantía de baterías (se generan al confirmar) | staff lee |
| `warranty_claims` | Reclamos de garantía | staff crea; admin/técnico atienden |

**Vistas** (todas con `security_invoker`, es decir, respetan el RLS de quien consulta): `v_stock`, `v_vehicle_costs`,
`v_price_matrix`, `v_batch_reconciliation`, `v_sales_margin` y `v_warranties`.
**Funciones RPC:** `pendientes_de_registro()`, `generar_lista_precios(batch_id)` y `guardar_costeo(batch_id, filas)`
(solo admin; ver §7 → Persistencia).

---

## 6. Reglas de negocio

Cada regla tiene un ID que se cita en el código y en las pruebas. La columna **Dónde** indica quién la garantiza.

| ID | Regla | Dónde |
|---|---|---|
| RN-01 | La cantidad de baterías de 12V se deriva del voltaje: **48V → 4, 60V → 5, 72V → 6**. Solo existen esos tres voltajes. | BD (columna generada + CHECK) |
| RN-02 | Nunca se registran más seriales de batería que los que exige el modelo. | BD (trigger) |
| RN-03 | VIN, número de motor y serial de batería son únicos y se guardan en MAYÚSCULAS y sin espacios. | BD |
| RN-04 | No se registran más unidades de un modelo que las declaradas en el packing list del lote. | BD |
| RN-05 | Los impuestos que se asignan al costo son el Ad Valorem más, si `impuestos_recuperables_al_costo = true`, el IGV, el IPM y la percepción. **Pendiente de validar con el contador** (ver PROGRESS → Preguntas abiertas). | BD (columna generada) |
| RN-06 | El prorrateo sigue exactamente la sección 7. | App (Fase 2) + validación en BD |
| RN-07 | Un lote solo se liquida si tiene tipo de cambio y **todos** sus modelos tienen costeo con la cantidad y el tipo de cambio vigentes. | BD |
| RN-08 | Un lote liquidado queda congelado: solo se pueden editar sus notas. Se reabre solo si no tiene unidades reservadas ni vendidas. | BD |
| RN-09 | Al liquidar un lote se genera su `price_list`. Si cambian los márgenes, se regeneran las listas de todos los lotes liquidados. Los precios manuales se conservan. | BD |
| RN-10 | Una unidad pasa de `en_ensamble` a `listo_en_tienda` solo si tiene **(a)** todos sus seriales de batería, **(b)** su **última** inspección aprobada y **(c)** una ubicación asignada. | BD |
| RN-11 | Una inspección se aprueba solo si `baterias_contadas = baterias_esperadas`, el VIN está verificado y el motor está verificado. `baterias_esperadas` la fija el sistema. Las inspecciones no se editan: si algo falla, se registra una nueva. | BD |
| RN-12 | Solo se venden unidades en `listo_en_tienda` de lotes **liquidados**. | BD |
| RN-13 | El precio de cada ítem sale de `price_list` según el tipo de venta de la orden; el cliente no puede enviarlo ni alterarlo. Si cambia el tipo de venta, se vuelven a cotizar todos los ítems. | BD |
| RN-14 | Para confirmar una orden se exigen: al menos 1 ítem, la cantidad mínima de la escala (x3 → 3, x6 → 6) y pagos que sumen **exactamente** el total. | BD |
| RN-15 | `metodo_pago` se deriva de los pagos: si hay más de un método, es `mixto`. | BD |
| RN-16 | Al confirmar una orden, sus unidades pasan a `vendido` y se crean dos garantías por unidad: la general (`garantia_meses`) y la de baterías (`garantia_baterias_meses`), con inicio en la fecha de Lima. | BD |
| RN-17 | Una orden confirmada solo admite cambios en su teléfono y su email. Solo el admin puede anularla, con motivo obligatorio. Al anularla, las unidades vuelven a tienda y sus garantías se anulan. | BD |
| RN-18 | Solo se eliminan órdenes en `borrador`. | BD |
| RN-19 | Solo se aceptan reclamos de garantías vigentes y no anuladas. | BD |
| RN-20 | Validación de documentos: DNI de 8 dígitos; RUC de 11 dígitos que empiece por 10, 15, 17 o 20; CE alfanumérico de 8 a 12 caracteres. | BD + zod en la UI |

---

## 7. Algoritmo de prorrateo (RN-06) — especificación exacta para la Fase 2

### Entradas
- Del lote: `tipo_cambio`, `fob_total_usd`, `flete_internacional_usd`, `gastos_agente_usd`, `impuestos_asignables_pen`,
  `flete_nacional_pen`, `alquiler_periodo_pen`, `sueldos_periodo_pen`, `publicidad_inicial_pen` y `costo_armado_unitario_pen`.
- Por línea `i` de `batch_items`: `qᵢ = cantidad_packing_list`, `EXWᵢ = exw_total_usd` y `CBMᵢ = cbm_total`.

### Proporciones
```
pEXWᵢ = EXWᵢ / Σ EXW       pCBMᵢ = CBMᵢ / Σ CBM       pQᵢ = qᵢ / Σ q
```

### Asignaciones (columnas de `batch_model_costs`)
| Columna | Fórmula | Criterio |
|---|---|---|
| `fob_asignado_usd` | pEXWᵢ × fob_total_usd | Valor |
| `impuestos_asignados_pen` | pEXWᵢ × impuestos_asignables_pen | Valor |
| `flete_internacional_asignado_usd` | pCBMᵢ × flete_internacional_usd | Volumen |
| `gastos_agente_asignado_usd` | pCBMᵢ × gastos_agente_usd | Volumen |
| `flete_nacional_asignado_pen` | pCBMᵢ × flete_nacional_pen | Volumen |
| `alquiler_asignado_pen` | pQᵢ × alquiler_periodo_pen | Cantidad |
| `sueldos_asignado_pen` | pQᵢ × sueldos_periodo_pen | Cantidad |
| `publicidad_asignada_pen` | pQᵢ × publicidad_inicial_pen | Cantidad |
| `armado_pen` | qᵢ × costo_armado_unitario_pen | Directo |
| `cantidad`, `tipo_cambio` | qᵢ y el tipo de cambio del lote | — |

La BD calcula sola:
`costo_total_pen = (fob + flete_intl + agente) × tipo_cambio + impuestos + flete_nac + alquiler + sueldos + publicidad + armado`
y `costo_landing_unitario_pen = round(costo_total_pen / cantidad, 2)`.

### Precisión y redondeo
- Todo el cálculo se hace con `decimal.js`. Cada asignación se redondea a **4 decimales** con *half-up*.
- **Cuadre exacto:** para cada concepto, la suma de las asignaciones debe ser igual al total del lote. El residuo de redondeo se suma a la línea con **mayor base** de ese criterio (en caso de empate, la primera por `codigo_modelo`).
- Errores: si Σ EXW = 0, Σ CBM = 0 o falta el tipo de cambio, se lanza un error de dominio y no se guarda nada.

### Invariantes (se prueban en Vitest; la RPC `guardar_costeo` vuelve a validar 1, 2 y 4 en SQL)
1. Para cada concepto, Σ asignado = total del lote, al centavo de 4 decimales.
2. Σ `costo_total_pen` = (FOB + flete internacional + agente) × TC + impuestos asignables + flete nacional + alquiler + sueldos + publicidad + Σq × armado.
3. La función es pura y determinista: la misma entrada da la misma salida, sin importar el orden de las líneas.
4. **Proporcionalidad por fila:** para cada fila y cada concepto, |asignado − total_concepto × baseᵢ / Σ bases| ≤ 0.01,
   con la base de su criterio tomada de `batch_items` (EXW para FOB e impuestos; CBM para flete internacional, agente y
   flete nacional; cantidad para alquiler, sueldos y publicidad). `armado_pen` debe ser **exactamente**
   qᵢ × `costo_armado_unitario_pen`. Los invariantes 1 y 2 solo miran totales; este impide un reparto con el criterio
   equivocado o con montos intercambiados entre modelos.

### Caso de referencia (*golden test*)
Lote: TC 3.78 · FOB 7 200 · flete internacional 800 · agente 200 (USD) · impuestos asignables 2 000 · flete nacional 400 · alquiler 1 000 · sueldos 2 000 · publicidad 200 · armado 60 (PEN).

| Modelo | q | EXW u. | CBM u. | fob | imp | flete int. | agente | flete nac. | alquiler | sueldos | public. | armado | **Unitario** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TEST-48 (48V) | 6 | 300 | 0.5 | 3600.0000 | 1000.0000 | 342.8571 | 85.7143 | 171.4286 | 750.0000 | 1500.0000 | 150.0000 | 360.0000 | **3193.24** |
| TEST-72 (72V) | 2 | 900 | 2.0 | 3600.0000 | 1000.0000 | 457.1429 | 114.2857 | 228.5714 | 250.0000 | 500.0000 | 50.0000 | 120.0000 | **8958.29** |

Costo total del lote = **S/ 37 076.00**. Precios esperados para TEST-48: x1 **5 805.89** · x3 **4 912.68** · x6 **4 435.06**.

### Persistencia
Supabase-js no ofrece transacciones, así que la Fase 2 crea la RPC `guardar_costeo(p_batch_id uuid, p_filas jsonb)` en una
**nueva migración**. Esta RPC (1) exige admin, (2) borra y vuelve a insertar las filas del lote en una sola transacción y
(3) **vuelve a validar en SQL** los invariantes 1, 2 y 4 (tolerancia de 0.01): si no cuadran, aborta. La liquidación es un
paso separado: `update import_batches set estado = 'liquidado'`.

- `p_filas` es un array JSON con el formato de `FilaCosteo` (mismos nombres de columna que `batch_model_costs`; los
  montos pueden ir como string). Devuelve las filas guardadas, con `costo_total_pen` y `costo_landing_unitario_pen`.
- También rechaza: lote inexistente, sin tipo de cambio o liquidado; filas que no correspondan **exactamente** a los
  modelos de `batch_items` (faltantes, sobrantes o repetidas); `cantidad` ≠ `cantidad_packing_list`; `tipo_cambio` ≠ el
  del lote; campos vacíos y montos negativos. Los mensajes están en español y se muestran tal cual.
- Pruebas: `tests/test_guardar_costeo.sql`.

---

## 8. Matriz de precios

`Precio = Costo_Landing_Unitario / (1 − Margen)`, redondeado a 2 decimales.

| Escala | Enum | Mínimo de unidades | Margen |
|---|---|---|---|
| Minorista | `unidad_x1` | 1 | 45 % |
| Mayorista | `mayorista_x3` | 3 | 35 % |
| Distribuidor | `distribuidor_x6` | 6 | 28 % |

- El margen es **sobre el precio de venta** (no es un *markup*): con un 45 %, la utilidad es el 45 % del precio.
- `precio_manual_pen` sobrescribe al sugerido (por ejemplo, para redondear a S/ 5 790); la UI debe marcar visualmente los precios manuales.
- Los precios **incluyen IGV** (supuesto de la v1; confirmar en PROGRESS → Preguntas abiertas).

---

## 9. Máquinas de estado

```
LOTE     en_transito → en_aduanas → en_almacen → liquidado        (reapertura: liquidado → en_almacen, RN-08)

UNIDAD   en_caja ⇄ en_ensamble ⇄ listo_en_tienda ⇄ reservado → vendido
                      └ RN-10 ┘                 └ orden ┘   └ confirmar ┘
         vendido → listo_en_tienda   (solo al anular la venta)
         reservado/vendido           (solo a través de órdenes, nunca manualmente)

ORDEN    borrador → confirmada → anulada (admin)
         borrador → anulada | eliminada
```

---

## 10. Módulos, pantallas y criterios de aceptación

Convenciones de la UI: todo en **español (es-PE)**; montos con el formato `S/ 1 234.56` y `US$ 1,234.56`; fechas en `dd/mm/aaaa`
con zona horaria `America/Lima`. Toda tabla tiene búsqueda, filtros por estado y exportación a CSV.

### M1 · Autenticación y usuarios — `/login`, `/admin/usuarios`
- Login con email y contraseña (Supabase Auth). Un middleware redirige a `/login` si no hay sesión, y a `/pendiente` si el usuario no tiene rol.
- El sidebar muestra solo los módulos permitidos para el rol.
- ✅ El admin lista usuarios, asigna y quita roles y desactiva cuentas. Un usuario sin rol ve la pantalla "Tu cuenta espera aprobación".

### M2 · Catálogo — `/admin/modelos`, `/admin/ubicaciones`
- CRUD de modelos. La cantidad de baterías se muestra en solo lectura y se deriva del voltaje.
- ✅ No se puede crear un modelo de 36V. Al elegir 60V se muestra "5 baterías de 12V".

### M3 · Lotes de importación — `/lotes`, `/lotes/[id]`
Pestañas de `/lotes/[id]`:
1. **Datos**: código de embarque, DAM, proveedor, fechas y estado.
2. **Costos**: bloques USD (FOB, flete, agente), SUNAT (Ad Valorem, IGV, IPM, percepción y el interruptor RN-05) y nacionales.
3. **Packing list**: líneas de modelo con cantidad del packing list y de la DAM; EXW y CBM se precargan desde el catálogo y son editables.
4. **Costeo**: vista previa del prorrateo con la tabla de la sección 7, el costo unitario y los precios x1/x3/x6. Botones: "Guardar costeo" y "Liquidar lote" (este último con confirmación, porque congela los costos).
5. **Unidades**: seriales registrados del lote.
6. **Auditoría**: `v_batch_reconciliation` con alertas en rojo.
- ✅ Con los datos del *golden test*, la pestaña Costeo muestra exactamente los valores de la sección 7.
- ✅ Tras liquidar, los campos de costo quedan deshabilitados y aparece el botón "Reabrir lote".

### M4 · Inventario y taller — `/inventario`, `/inventario/registro`, `/taller`, `/taller/[vehicleId]`
- `/inventario`: tabla sobre `v_stock` con filtros por estado, modelo, ubicación y color.
- `/inventario/registro`: registro masivo de VIN y motor pegando desde Excel (columnas VIN, motor, color 1 y color 2) o con un lector de código de barras. Muestra "faltan X de Y" según `pendientes_de_registro()`.
- `/taller`: cola de unidades `en_caja` y `en_ensamble`. **Diseño móvil primero** (el técnico usa el celular).
- `/taller/[id]`: (1) escanear los seriales de batería (N casillas según el voltaje); (2) checklist de inspección (baterías contadas, VIN, motor, frenos, luces, claxon, voltaje medido); (3) botón "Pasar a tienda" con selector de ubicación, habilitado solo si se cumple RN-10.
- ✅ Una unidad de 72V muestra 6 casillas de batería. Si la inspección se registra con 5 baterías, queda "Observada" y el botón sigue deshabilitado.

### M5 · Precios — `/precios`
- Admin: `v_price_matrix` con costo, precios y utilidad por escala. Edición inline de `precio_manual_pen` y de los márgenes globales.
- Vendedor: solo modelo, stock disponible y precios x1/x3/x6.
- ✅ Si un vendedor inspecciona la respuesta de red, no aparece ningún costo.

### M6 · Punto de venta — `/ventas`, `/ventas/nueva`, `/ventas/[id]`
- Flujo de `/ventas/nueva`: (1) tipo de venta; (2) agregar unidades buscando por VIN o por modelo y color; (3) datos del cliente (DNI/RUC/CE validados); (4) pagos, uno o varios, con el saldo pendiente siempre visible; (5) "Confirmar venta".
- `/ventas/[id]`: detalle, nota de venta imprimible (PDF o `window.print`) y botón "Anular" (solo admin, con motivo).
- ✅ Una orden x6 con 5 unidades muestra "Faltan 1 unidad para precio distribuidor" y no se puede confirmar.
- ✅ Si hay 2 pestañas intentando vender la misma unidad, la segunda recibe "La unidad no está disponible".

### M7 · Garantías — `/garantias`
- Búsqueda por VIN, DNI o RUC. Muestra la cobertura, si está vigente y los días restantes. Permite registrar un reclamo y darle seguimiento (abierto → en revisión → aprobado o rechazado → cerrado).

### M8 · Auditoría y reportes — `/auditoria`, `/` (dashboard)
- Dashboard: unidades por estado, ventas del día y del mes, margen promedio (solo admin) y alertas de conciliación.
- Reporte de margen real por venta y por modelo, exportable a CSV.

---

## 11. Requisitos no funcionales
- **Seguridad**: la `service_role key` nunca llega al navegador. Toda operación del usuario pasa por el cliente con su JWT y queda sujeta a RLS.
- **Tipos**: `src/types/database.ts` se regenera después de cada migración.
- **Rendimiento**: los listados se paginan en el servidor (50 filas); la cola del taller carga en menos de 1 s en 4G.
- **Accesibilidad**: los formularios se pueden usar con teclado y los lectores de código de barras funcionan como un teclado (Enter = siguiente campo).
- **Errores**: los mensajes de los triggers de la BD (en español) se muestran tal cual en un toast; ya están redactados para el usuario final.
