# ESPECIFICACIÓN DEL SISTEMA DE GESTIÓN (ERP / CRM) - VEHÍCULOS ELÉCTRICOS

## 1. Visión General del Proyecto
Plataforma web para gestionar el ciclo de vida completo de lotes de importación:
1. Registro y prorrateo de costos de importación y logística nacional.
2. Control de inventario por número de serie (VIN, Motor, Baterías).
3. Matriz de precios dinámica (Escala x1, x3, x6 unidades).
4. Punto de venta (POS), órdenes de venta y seguimiento de garantías.

---

## 2. Modelo de Datos y Entidades Principales

### A. Lotes de Importación (`import_batches`)
- `id`: UUID
- `codigo_embarque`: VARCHAR (Ej. 117GZH2606089)
- `nro_dam`: VARCHAR (Ej. 118-2026-10-361056-01-0-00)
- `tipo_cambio`: DECIMAL (Ej. 3.78)
- `fob_total_usd`: DECIMAL
- `flete_internacional_usd`: DECIMAL
- `impuestos_sunat_pen`: DECIMAL (Ad Valorem, IGV, IPM, Percepción)
- `flete_nacional_pen`: DECIMAL (Callao -> Destino)
- `gastos_operativos_fijos_pen`: DECIMAL (Alquiler, sueldos de periodo)
- `publicidad_inicial_pen`: DECIMAL
- `costo_armado_unitario_pen`: DECIMAL (Defecto: S/ 60.00)
- `estado`: ENUM ('en_transito', 'en_aduanas', 'en_almacen', 'liquidado')

### B. Catálogo de Modelos (`vehicle_models`)
- `id`: UUID
- `codigo_modelo`: VARCHAR (Ej. XSDU-29, XSDU-31, XSDU-35, XSDU-36, XSDU-23, XSDU-24, XSDU-25, XSDU-17)
- `categoria`: ENUM ('bicimoto', 'trimoto_pasajeros', 'trimoto_carga')
- `voltaje_sistema`: INT (48, 60, 72)
- `cantidad_baterias_12v`: INT (4 para 48V, 5 para 60V, 6 para 72V)
- `amperaje_bateria`: VARCHAR (Ej. 20Ah)
- `potencia_motor_watts`: INT (500W, 600W, 800W, 1000W, 1200W)
- `volumen_cbm_unitario`: DECIMAL (m3)
- `exw_usd_unitario`: DECIMAL

### C. Unidades Físicas / Seriales (`vehicle_inventory`)
- `id`: UUID
- `batch_id`: FK -> import_batches
- `model_id`: FK -> vehicle_models
- `vin_chasis`: VARCHAR (Único)
- `nro_motor`: VARCHAR
- `color_primario`: VARCHAR
- `color_secundario`: VARCHAR
- `costo_landing_calculado_pen`: DECIMAL
- `estado`: ENUM ('en_caja', 'en_ensamble', 'listo_en_tienda', 'reservado', 'vendido')
- `ubicacion`: VARCHAR (Ej. Showroom Piérola, Almacén Central)

### D. Ventas y Clientes (`sales_orders` & `order_items`)
- `cliente_nombre`: VARCHAR
- `cliente_documento`: VARCHAR (DNI / RUC)
- `tipo_venta`: ENUM ('unidad_x1', 'mayorista_x3', 'distribuidor_x6')
- `total_pen`: DECIMAL
- `metodo_pago`: ENUM ('efectivo', 'transferencia', 'tarjeta', 'mixto')

---

## 3. Lógica de Negocio y Reglas Críticas

### 3.1. Algoritmo de Prorrateo Automático de Costos
Al liquidar un contenedor, el costo landing por modelo se calcula combinando criterios:
1. **Prorrateo por Valor FOB (%):**
   - FOB ajustado por modelo = `(EXW_Total_Modelo / EXW_Total_Lote) * FOB_Total_USD`
   - Impuestos SUNAT asignados = `(EXW_Total_Modelo / EXW_Total_Lote) * Impuestos_SUNAT_PEN`
2. **Prorrateo por Volumen CBM (%):**
   - Flete internacional y gastos de agente = `(CBM_Total_Modelo / CBM_Total_Lote) * Gastos_Agente_USD`
   - Flete terrestre nacional = `(CBM_Total_Modelo / CBM_Total_Lote) * Flete_Nacional_PEN`
3. **Prorrateo Fijo por Cantidad de Unidades:**
   - Alquiler asignado = `(Cantidad_Modelo / Cantidad_Total_Motos) * Alquiler_Total_Periodo`
   - Sueldo asignado = `(Cantidad_Modelo / Cantidad_Total_Motos) * Sueldos_Total_Periodo`
   - Publicidad asignada = `(Cantidad_Modelo / Cantidad_Total_Motos) * Publicidad_Total`
   - Armado técnico = `Cantidad_Modelo * S/ 60.00`

### 3.2. Reglas de Baterías e Inspección Técnica
- Toda moto debe validar físicamente la cantidad de baterías de 12V según el voltaje:
  - 48V = 4 unidades de 12V.
  - 60V = 5 unidades de 12V.
  - 72V = 6 unidades de 12V.
- Módulo de auditoría para cotejar contra packing list y DAM aduanera.

### 3.3. Matriz de Precios Automatizada
Fórmula: `Precio = Costo_Landing / (1 - Margen_Objetivo)`
- Margen x6 unidades: 28%
- Margen x3 unidades: 35%
- Margen x1 unidad (minorista): 45%

---

## 4. Stack Tecnológico Sugerido
- **Frontend:** React / Next.js (Tailwind CSS + Shadcn/ui)
- **Backend / Base de datos:** Supabase (PostgreSQL) o Node.js + Express
- **Autenticación y Roles:** Administrador, Técnico Ensamblador, Vendedor