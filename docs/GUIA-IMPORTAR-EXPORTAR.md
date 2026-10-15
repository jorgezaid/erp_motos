# Guía: cargar los datos reales y exportar

> Estado al 2026-10-15. Todavía **no hay un importador de Excel** (.xlsx) ni un botón "Descargar plantilla":
> los datos de `docs/plantillas/plantilla-datos-reales-erp-v2.xlsx` se cargan pantalla por pantalla, y las
> exportaciones son **CSV** (se abren en Excel). Cuando exista el importador, esta guía se actualiza.

Las rutas son iguales en local (`http://localhost:3000`) y en producción (`https://erp-motos-upvt.vercel.app`).
Todo lo de esta guía lo hace un usuario **admin**, salvo donde se indica.

## 1. Antes de empezar
1. Llena la plantilla v2. Las celdas amarillas son para llenar, las filas grises son ejemplos (no se cargan) y las
   verdes se calculan solas.
2. Responde primero la hoja **Preguntas negocio**: cambia costos y precios. Lo más importante es si el IGV, el IPM y
   la percepción son crédito fiscal.
3. No escribas contraseñas en el archivo.

## 2. Orden de carga
Respeta este orden: cada paso necesita el anterior.

| # | Hoja de la plantilla | Pantalla | Qué hacer |
|---|---|---|---|
| 1 | Ubicaciones | `/admin/ubicaciones` | Ya existen 3 (almacén, showroom y taller). Corrige los nombres y agrega las que falten con "Nueva ubicación". |
| 2 | Usuarios | Supabase → Authentication → *Add user*, y luego `/admin/usuarios` | Crea la cuenta en Supabase y después asígnale el rol (admin, técnico o vendedor). Una cuenta sin rol no ve nada. |
| 3 | Modelos | `/admin/modelos` | Un modelo por fila (XSDU-17, 23, 24, 25, 29, 31, 35 y 36): voltaje (48/60/72 V), Ah, W, CBM, EXW y meses de garantía. La cantidad de baterías se calcula sola. |
| 4 | Lote | `/lotes` → "Nuevo lote", y luego `/lotes/[id]` (Datos) y `/lotes/[id]/costos` | Crea el lote con el código de embarque y el proveedor. En **Datos** carga la DAM, las fechas y el estado. En **Costos** carga el TC, el FOB, los fletes, los impuestos SUNAT y los gastos del periodo, y el interruptor "impuestos al costo" según la respuesta del contador. Si tienes varios contenedores, repite este paso por cada hoja "Lote". |
| 5 | Packing list | `/lotes/[id]/packing` | Una línea por modelo, con la cantidad del packing list y la de la DAM. El EXW y el CBM vienen del catálogo: cámbialos solo si la factura dice otro valor. |
| 6 | Unidades | `/inventario/registro` (admin o técnico) | Ver la sección 3. |
| 7 | Baterías (opcional) | `/taller/[id]` (técnico) | Escanea los seriales de cada unidad al armarla. No hay carga masiva de baterías. |
| 8 | — | `/lotes/[id]/costeo` | "Guardar costeo" y, cuando todo cuadre, "Liquidar". Solo desde ese momento hay precios en `/precios`. |

## 3. Pegar las unidades desde Excel
1. En `/inventario/registro`, elige el **lote y el modelo**. La pantalla muestra "Faltan X de Y" según el packing
   list.
2. La hoja Unidades no tiene una columna de modelo: **ordénala por modelo y pega un modelo a la vez**.
3. Copia las columnas **VIN, motor, color 1 y color 2**, en ese orden. Puedes incluir la fila de encabezados (se
   ignora). La 5.ª columna, "Situación actual", tampoco se carga: todas las unidades entran **en caja**.
4. Revisa la **vista previa** antes de guardar:
   - Cada fila con su VIN y su motor, ya en mayúsculas y sin espacios (RN-03).
   - Errores por fila: falta el VIN o el motor, el VIN es igual al motor, o hay valores repetidos en lo pegado.
   - Que no pegues más unidades de las que faltan para ese modelo.
5. El guardado es **todo o nada**: si una sola fila falla, no se guarda ninguna.

**Si hay errores:** corrige esas filas en el Excel (o quítalas de la vista previa) y vuelve a pegar. Si el
sistema dice "El VIN ya está registrado.", esa unidad ya existe: búscala en `/inventario` y quítala de lo pegado.
Si faltan o sobran unidades, corrige primero la cantidad en `/lotes/[id]/packing`.

Las unidades que ya estaban armadas o vendidas antes del sistema no tienen todavía una carga especial (ver la
pregunta de la hoja Preguntas negocio).

## 4. Qué revisar después de cargar un lote
- `/lotes/[id]/auditoria`: las filas en rojo son diferencias entre el packing list, la DAM y las unidades
  registradas. Corrígelas antes de liquidar.
- `/lotes/[id]/costeo`: el total EXW debería estar cerca del FOB de la factura. El costo landing por modelo debe
  parecer razonable.
- `/precios`: después de liquidar, revisa el precio x1 de cada modelo y fija el margen real del negocio.

## 5. Exportar
Cada listado tiene un botón **CSV** junto a los filtros. El archivo respeta la búsqueda y los filtros que tengas
puestos (máximo 5000 filas) y se abre en Excel con tildes correctas.

| Pantalla | Botón en | Quién lo ve |
|---|---|---|
| Inventario | `/inventario` | todos (los costos nunca salen) |
| Ventas | `/ventas` | admin y vendedor |
| Precios | `/precios` | admin (con costos) y vendedor (sin costos) |
| Lotes | `/lotes` | admin |
| Unidades de un lote | `/lotes/[id]/unidades` | admin |
| Auditoría de un lote | `/lotes/[id]/auditoria` | admin |
| Garantías | `/garantias` | todos |
| Auditoría general | `/auditoria` | admin |
| Taller | `/taller` | admin y técnico |
| Modelos, ubicaciones y usuarios | `/admin/modelos`, `/admin/ubicaciones`, `/admin/usuarios` | admin |

Todavía no existen la exportación a .xlsx ni la del lote completo en formato de plantilla.
