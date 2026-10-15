# Guía: cargar los datos reales y exportar

> Actualizada el 2026-10-15 (tarea 11.1). Los datos se cargan subiendo la plantilla llena en **Importar Excel**.
> Las exportaciones siguen siendo **CSV** (se abren en Excel).

Las rutas son iguales en local (`http://localhost:3000`) y en producción (`https://erp-motos-upvt.vercel.app`).
El importador lo usa solo un **admin**.

## 1. Antes de empezar
1. Llena `docs/plantillas/plantilla-datos-reales-erp-v2.xlsx`. **No muevas ni renombres hojas o columnas**: el
   importador exige ese formato exacto. Las celdas amarillas son para llenar; la fila gris de EJEMPLO y las celdas
   verdes se ignoran (el sistema las recalcula).
2. Responde primero la hoja **Preguntas negocio** (no se importa, pero cambia costos y precios). Lo más importante:
   si el IGV, el IPM y la percepción son crédito fiscal.
3. **Un lote por archivo.** Si tienes varios contenedores, usa un archivo por cada uno.
4. No escribas contraseñas en el archivo.

## 2. Qué llenar en cada hoja
| Hoja | Qué hace el importador |
|---|---|
| Ubicaciones | Crea las que no existen y actualiza tipo y dirección de las que ya existen (por nombre). Para **renombrar** una ubicación, hazlo en `/admin/ubicaciones`: un nombre nuevo en el Excel crea otra ubicación. |
| Usuarios | **No crea cuentas.** Muestra la lista para crearlas a mano: Supabase → Authentication → *Add user*, y después el rol en `/admin/usuarios`. |
| Modelos | Crea o actualiza cada modelo por su código. Las filas que solo tienen el código (XSDU-17, 23…) sin datos se ignoran. Un modelo nuevo necesita categoría, voltaje (48, 60 o 72), Ah, W, CBM y EXW. |
| Lote | Crea el lote (por código de embarque) o actualiza sus datos y costos. Entra "en tránsito"; el estado se cambia en el lote. |
| Packing list | Una línea por modelo. El EXW es el de la factura (columna D) o, si está vacía, el del catálogo; el CBM, el del catálogo. |
| Unidades | Una fila por unidad, con su código de modelo. Entran **en caja**. La Situación debe ser `en_caja` (o vacía): otros valores todavía no se soportan. |
| Baterías (opcional) | Seriales por VIN: hasta 4 (48V), 5 (60V) o 6 (72V). Si no los tienes, el técnico los escanea en `/taller/[id]`. |

## 3. Importar
1. Abre **Administración → Importar Excel** (`/admin/importar`).
2. Elige el archivo y pulsa **Importar Excel**. No se guarda nada todavía: el servidor lee y valida el archivo.
3. Revisa la **vista previa**:
   - El **resumen por hoja**: cuántas filas se crean y cuántas ya existen (estas se actualizan solo si cambió algo).
   - El lote: "nuevo" o "ya existe: se actualiza".
   - La lista de **usuarios** para crear en Supabase.
   - La lista de **errores**, con hoja y fila.
4. Si no hay errores, pulsa **Confirmar**. Se guarda **todo o nada**, en este orden: ubicaciones → modelos → lote →
   packing list → unidades → baterías.
5. Después ve al lote (`/lotes/[id]`): revisa la pestaña **Auditoría**, y en **Costeo** guarda el costeo y liquida. El
   importador **no costea ni liquida**.

### Si hay errores
"Confirmar" queda deshabilitado. Corrige las filas indicadas en el Excel y vuelve a subir el archivo. Los errores más
comunes:

| Error | Qué hacer |
|---|---|
| VIN, motor o serial repetido (en el archivo o ya registrado) | Corrige el valor. Un VIN registrado en otro lote no se puede mover desde el importador. |
| El modelo X no existe | Complétalo en la hoja Modelos (con todos sus datos) o revisa el código. |
| El modelo no está en el packing list | Agrega la línea de ese modelo en la hoja Packing list. |
| Voltaje no válido | Usa 48, 60 o 72. |
| El packing list declara N unidades y habría M | Revisa la cantidad del packing list o sobran filas en Unidades. |
| Monto negativo / no es un número / fecha inválida | Corrige la celda. Las fechas van como dd/mm/aaaa. |
| El lote está liquidado | Reábrelo en su pestaña Costeo, o usa un archivo para otro lote. |
| Más baterías que voltaje/12 | Quita los seriales sobrantes. |
| Situación no soportada | Solo se importan unidades en caja. |
| La columna X debería ser «…» / falta la hoja | No uses otro formato: parte de la plantilla v2 original. |

Si al confirmar la base de datos rechaza algo, el mensaje también dice la hoja y la fila, y no se guarda nada.

### Reimportar un archivo corregido
Puedes subir de nuevo el mismo archivo (si el lote no está liquidado): no se duplica ni se borra nada. Cada fila se
busca por su clave (nombre, código de modelo, código de embarque, VIN o serial) y solo se actualiza lo que cambió. Lo
que no está en el archivo queda como está, y una celda vacía conserva el valor que ya había. Si cambian los montos o
el packing list de un lote, su costeo guardado se borra (D21) y hay que volver a guardarlo.

## 4. Exportar
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

Todavía no hay exportación a .xlsx ni del lote completo en formato de plantilla.
