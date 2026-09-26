-- =============================================================================
-- ERP Vehículos Eléctricos — Migración 1/3: Tipos, tablas e índices
-- Destino: Supabase (PostgreSQL 15+)
-- =============================================================================
-- Convenciones:
--   * Montos en PEN / USD: numeric(14,2). Prorrateos intermedios: numeric(16,4).
--   * Todas las tablas usan UUID (gen_random_uuid) y timestamps con zona.
--   * Los datos de COSTO viven en tablas de acceso exclusivo para administradores
--     (import_batches, batch_items, batch_model_costs). Vendedores y técnicos
--     nunca pueden leer costos, ni siquiera desde el navegador (ver RLS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.app_role          as enum ('admin', 'tecnico', 'vendedor');
create type public.batch_status      as enum ('en_transito', 'en_aduanas', 'en_almacen', 'liquidado');
create type public.vehicle_category  as enum ('bicimoto', 'trimoto_pasajeros', 'trimoto_carga');
create type public.vehicle_status    as enum ('en_caja', 'en_ensamble', 'listo_en_tienda', 'reservado', 'vendido');
create type public.sale_type         as enum ('unidad_x1', 'mayorista_x3', 'distribuidor_x6');
create type public.payment_method    as enum ('efectivo', 'transferencia', 'tarjeta', 'mixto');
create type public.order_status      as enum ('borrador', 'confirmada', 'anulada');
create type public.document_type     as enum ('DNI', 'RUC', 'CE');
create type public.location_type     as enum ('almacen', 'showroom', 'taller');
create type public.warranty_coverage as enum ('general', 'baterias');
create type public.claim_status      as enum ('abierto', 'en_revision', 'aprobado', 'rechazado', 'cerrado');

-- -----------------------------------------------------------------------------
-- 2. Usuarios y roles
-- -----------------------------------------------------------------------------
-- Un perfil por usuario de Supabase Auth. `rol` nulo = cuenta pendiente de
-- aprobación: no ve nada hasta que un admin le asigne un rol.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null default '',
  rol         public.app_role,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3. Ubicaciones físicas (Showroom Piérola, Almacén Central, etc.)
-- -----------------------------------------------------------------------------
create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  tipo        public.location_type not null,
  direccion   text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4. Catálogo de modelos
-- -----------------------------------------------------------------------------
create table public.vehicle_models (
  id                        uuid primary key default gen_random_uuid(),
  codigo_modelo             text not null unique,            -- XSDU-29, XSDU-31...
  nombre_comercial          text,
  categoria                 public.vehicle_category not null,
  voltaje_sistema           int  not null check (voltaje_sistema in (48, 60, 72)),
  -- Regla 3.2: 48V=4, 60V=5, 72V=6 baterías de 12V. Se DERIVA del voltaje,
  -- así es imposible registrar un modelo con una cantidad inconsistente.
  cantidad_baterias_12v     int  generated always as (voltaje_sistema / 12) stored,
  amperaje_bateria_ah       int  not null check (amperaje_bateria_ah > 0),   -- 20 => "20Ah"
  potencia_motor_watts      int  not null check (potencia_motor_watts > 0),
  volumen_cbm_unitario      numeric(10,4) not null check (volumen_cbm_unitario > 0),
  exw_usd_unitario          numeric(12,2) not null check (exw_usd_unitario >= 0), -- precio referencial de catálogo
  garantia_meses            int  not null default 12 check (garantia_meses >= 0),
  garantia_baterias_meses   int  not null default 6  check (garantia_baterias_meses >= 0),
  activo                    boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 5. Lotes de importación  (SOLO ADMIN — contiene costos)
-- -----------------------------------------------------------------------------
create table public.import_batches (
  id                          uuid primary key default gen_random_uuid(),
  codigo_embarque             text not null unique,          -- 117GZH2606089
  nro_dam                     text unique,                   -- 118-2026-10-361056-01-0-00
  proveedor                   text,
  fecha_embarque              date,
  fecha_llegada               date,
  tipo_cambio                 numeric(8,4) check (tipo_cambio > 0),   -- obligatorio para liquidar

  -- Costos en USD (prorrateo por valor y por volumen)
  fob_total_usd               numeric(14,2) not null default 0 check (fob_total_usd >= 0),
  flete_internacional_usd     numeric(14,2) not null default 0 check (flete_internacional_usd >= 0),
  gastos_agente_usd           numeric(14,2) not null default 0 check (gastos_agente_usd >= 0),

  -- Impuestos SUNAT desglosados (PEN)
  ad_valorem_pen              numeric(14,2) not null default 0 check (ad_valorem_pen >= 0),
  igv_pen                     numeric(14,2) not null default 0 check (igv_pen >= 0),
  ipm_pen                     numeric(14,2) not null default 0 check (ipm_pen >= 0),
  percepcion_pen              numeric(14,2) not null default 0 check (percepcion_pen >= 0),
  impuestos_sunat_pen         numeric(14,2) generated always as
                                (ad_valorem_pen + igv_pen + ipm_pen + percepcion_pen) stored,
  -- IGV, IPM y percepción suelen ser crédito fiscal recuperable. Por defecto se
  -- cargan al costo (fiel a la especificación); poner en FALSE para costear
  -- solo el Ad Valorem.
  impuestos_recuperables_al_costo boolean not null default true,
  impuestos_asignables_pen    numeric(14,2) generated always as (
                                ad_valorem_pen + case when impuestos_recuperables_al_costo
                                                      then igv_pen + ipm_pen + percepcion_pen
                                                      else 0 end) stored,

  -- Costos nacionales (PEN)
  flete_nacional_pen          numeric(14,2) not null default 0 check (flete_nacional_pen >= 0),
  alquiler_periodo_pen        numeric(14,2) not null default 0 check (alquiler_periodo_pen >= 0),
  sueldos_periodo_pen         numeric(14,2) not null default 0 check (sueldos_periodo_pen >= 0),
  gastos_operativos_fijos_pen numeric(14,2) generated always as
                                (alquiler_periodo_pen + sueldos_periodo_pen) stored,
  publicidad_inicial_pen      numeric(14,2) not null default 0 check (publicidad_inicial_pen >= 0),
  costo_armado_unitario_pen   numeric(10,2) not null default 60.00 check (costo_armado_unitario_pen >= 0),

  estado                      public.batch_status not null default 'en_transito',
  liquidado_at                timestamptz,
  liquidado_por               uuid references public.profiles (id),
  notas                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Líneas del packing list: qué modelos y cuántos trae cada lote.
-- EXW y CBM se copian del catálogo al crear la línea (snapshot) y pueden
-- ajustarse a la factura real sin alterar el catálogo.
create table public.batch_items (
  id                      uuid primary key default gen_random_uuid(),
  batch_id                uuid not null references public.import_batches (id) on delete cascade,
  model_id                uuid not null references public.vehicle_models (id),
  cantidad_packing_list   int  not null check (cantidad_packing_list > 0),
  cantidad_dam            int  check (cantidad_dam >= 0),          -- lo declarado en la DAM
  exw_usd_unitario        numeric(12,2) not null check (exw_usd_unitario >= 0),
  volumen_cbm_unitario    numeric(10,4) not null check (volumen_cbm_unitario > 0),
  exw_total_usd           numeric(14,2) generated always as (cantidad_packing_list * exw_usd_unitario) stored,
  cbm_total               numeric(12,4) generated always as (cantidad_packing_list * volumen_cbm_unitario) stored,
  created_at              timestamptz not null default now(),
  unique (batch_id, model_id)
);

-- Resultado del prorrateo (sección 3.1) por lote y modelo.
-- La función de costeo (Paso 2) llena los COMPONENTES; el total y el costo
-- unitario los calcula la base de datos, así nunca pueden quedar descuadrados.
create table public.batch_model_costs (
  batch_id                          uuid not null references public.import_batches (id) on delete cascade,
  model_id                          uuid not null references public.vehicle_models (id),
  cantidad                          int  not null check (cantidad > 0),
  tipo_cambio                       numeric(8,4) not null check (tipo_cambio > 0),
  -- Prorrateo por valor EXW
  fob_asignado_usd                  numeric(16,4) not null default 0,
  impuestos_asignados_pen           numeric(16,4) not null default 0,
  -- Prorrateo por volumen CBM
  flete_internacional_asignado_usd  numeric(16,4) not null default 0,
  gastos_agente_asignado_usd        numeric(16,4) not null default 0,
  flete_nacional_asignado_pen       numeric(16,4) not null default 0,
  -- Prorrateo por cantidad de unidades
  alquiler_asignado_pen             numeric(16,4) not null default 0,
  sueldos_asignado_pen              numeric(16,4) not null default 0,
  publicidad_asignada_pen           numeric(16,4) not null default 0,
  armado_pen                        numeric(16,4) not null default 0,
  -- Totales derivados
  costo_total_pen numeric(16,4) generated always as (
      (fob_asignado_usd + flete_internacional_asignado_usd + gastos_agente_asignado_usd) * tipo_cambio
    + impuestos_asignados_pen + flete_nacional_asignado_pen
    + alquiler_asignado_pen + sueldos_asignado_pen + publicidad_asignada_pen + armado_pen
  ) stored,
  costo_landing_unitario_pen numeric(14,2) generated always as (round((
      (fob_asignado_usd + flete_internacional_asignado_usd + gastos_agente_asignado_usd) * tipo_cambio
    + impuestos_asignados_pen + flete_nacional_asignado_pen
    + alquiler_asignado_pen + sueldos_asignado_pen + publicidad_asignada_pen + armado_pen
  ) / cantidad, 2)) stored,
  calculado_at                      timestamptz not null default now(),
  calculado_por                     uuid references public.profiles (id),
  primary key (batch_id, model_id),
  foreign key (batch_id, model_id) references public.batch_items (batch_id, model_id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- 6. Matriz de precios (sección 3.3)
-- -----------------------------------------------------------------------------
create table public.price_margins (
  tipo_venta        public.sale_type primary key,
  cantidad_minima   int not null check (cantidad_minima >= 1),
  margen_objetivo   numeric(5,4) not null check (margen_objetivo >= 0 and margen_objetivo < 1),
  updated_at        timestamptz not null default now()
);

-- Precios por lote + modelo + tipo de venta. Visible para vendedores (no
-- revela el costo). `precio_manual_pen` permite redondear o ajustar a mano.
create table public.price_list (
  batch_id            uuid not null references public.import_batches (id) on delete cascade,
  model_id            uuid not null references public.vehicle_models (id),
  tipo_venta          public.sale_type not null references public.price_margins (tipo_venta),
  precio_sugerido_pen numeric(14,2) not null check (precio_sugerido_pen > 0),
  precio_manual_pen   numeric(14,2) check (precio_manual_pen > 0),
  precio_venta_pen    numeric(14,2) generated always as (coalesce(precio_manual_pen, precio_sugerido_pen)) stored,
  updated_at          timestamptz not null default now(),
  primary key (batch_id, model_id, tipo_venta)
);

-- -----------------------------------------------------------------------------
-- 7. Inventario serializado
-- -----------------------------------------------------------------------------
create table public.vehicle_inventory (
  id                uuid primary key default gen_random_uuid(),
  batch_id          uuid not null,
  model_id          uuid not null references public.vehicle_models (id),
  vin_chasis        text not null unique check (length(trim(vin_chasis)) > 0),
  nro_motor         text not null unique check (length(trim(nro_motor)) > 0),
  color_primario    text,
  color_secundario  text,
  estado            public.vehicle_status not null default 'en_caja',
  location_id       uuid references public.locations (id),
  notas             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- La unidad debe pertenecer a un modelo declarado en el packing list del lote
  foreign key (batch_id, model_id) references public.batch_items (batch_id, model_id)
);

-- Seriales de las baterías de 12V instaladas en cada unidad
create table public.vehicle_batteries (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.vehicle_inventory (id) on delete cascade,
  serial      text not null unique check (length(trim(serial)) > 0),
  posicion    smallint check (posicion between 1 and 6),
  created_at  timestamptz not null default now(),
  unique (vehicle_id, posicion)
);

-- Inspección técnica / pre-entrega (sección 3.2)
create table public.technical_inspections (
  id                  uuid primary key default gen_random_uuid(),
  vehicle_id          uuid not null references public.vehicle_inventory (id) on delete cascade,
  inspector_id        uuid references public.profiles (id) default auth.uid(),
  baterias_esperadas  int  not null,              -- lo fija un trigger desde el modelo
  baterias_contadas   int  not null check (baterias_contadas >= 0),
  voltaje_medido      numeric(5,2),
  vin_verificado      boolean not null default false,
  motor_verificado    boolean not null default false,
  checklist           jsonb   not null default '{}'::jsonb,   -- frenos, luces, claxon, etc.
  aprobada            boolean generated always as (
                        baterias_contadas = baterias_esperadas and vin_verificado and motor_verificado
                      ) stored,
  observaciones       text,
  created_at          timestamptz not null default now()
);

-- Historial de cambios de estado de cada unidad (trazabilidad)
create table public.vehicle_status_history (
  id               bigint generated always as identity primary key,
  vehicle_id       uuid not null references public.vehicle_inventory (id) on delete cascade,
  estado_anterior  public.vehicle_status,
  estado_nuevo     public.vehicle_status not null,
  location_id      uuid references public.locations (id),
  changed_by       uuid default auth.uid(),
  changed_at       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 8. Ventas
-- -----------------------------------------------------------------------------
create table public.sales_orders (
  id                      uuid primary key default gen_random_uuid(),
  numero                  bigint generated always as identity unique,   -- correlativo legible
  cliente_nombre          text not null check (length(trim(cliente_nombre)) > 0),
  cliente_tipo_documento  public.document_type not null,
  cliente_documento       text not null,
  cliente_telefono        text,
  cliente_email           text,
  tipo_venta              public.sale_type not null default 'unidad_x1',
  metodo_pago             public.payment_method,        -- se fija al confirmar (mixto si hay >1 método)
  total_pen               numeric(14,2) not null default 0,
  estado                  public.order_status not null default 'borrador',
  vendedor_id             uuid references public.profiles (id) default auth.uid(),
  confirmada_at           timestamptz,
  anulada_at              timestamptz,
  motivo_anulacion        text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint documento_valido check (
       (cliente_tipo_documento = 'DNI' and cliente_documento ~ '^[0-9]{8}$')
    or (cliente_tipo_documento = 'RUC' and cliente_documento ~ '^(10|15|17|20)[0-9]{9}$')
    or (cliente_tipo_documento = 'CE'  and cliente_documento ~ '^[A-Za-z0-9]{8,12}$')
  ),
  constraint anulacion_con_motivo check (estado <> 'anulada' or motivo_anulacion is not null)
);

create table public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.sales_orders (id) on delete cascade,
  vehicle_id          uuid not null references public.vehicle_inventory (id),
  precio_unitario_pen numeric(14,2) not null default 0,   -- lo fija un trigger desde price_list
  activo              boolean not null default true,       -- false cuando la orden se anula
  created_at          timestamptz not null default now()
);
-- Una unidad solo puede estar en UNA orden viva a la vez
create unique index order_items_vehiculo_activo_uk on public.order_items (vehicle_id) where activo;

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.sales_orders (id) on delete cascade,
  metodo      public.payment_method not null check (metodo <> 'mixto'),
  monto_pen   numeric(14,2) not null check (monto_pen > 0),
  referencia  text,                                   -- nro. operación / voucher
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 9. Garantías
-- -----------------------------------------------------------------------------
create table public.warranties (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references public.vehicle_inventory (id),
  order_id      uuid not null references public.sales_orders (id),
  cobertura     public.warranty_coverage not null,
  fecha_inicio  date not null,
  fecha_fin     date not null,
  anulada       boolean not null default false,
  created_at    timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);

create table public.warranty_claims (
  id                    uuid primary key default gen_random_uuid(),
  warranty_id           uuid not null references public.warranties (id),
  descripcion           text not null,
  diagnostico           text,
  estado                public.claim_status not null default 'abierto',
  tecnico_id            uuid references public.profiles (id),
  costo_reparacion_pen  numeric(14,2) check (costo_reparacion_pen >= 0),
  registrado_por        uuid default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 10. Índices para las consultas frecuentes
-- -----------------------------------------------------------------------------
create index on public.batch_items (model_id);
create index on public.vehicle_inventory (batch_id, model_id);
create index on public.vehicle_inventory (estado);
create index on public.vehicle_inventory (location_id);
create index on public.vehicle_batteries (vehicle_id);
create index on public.technical_inspections (vehicle_id, created_at desc);
create index on public.vehicle_status_history (vehicle_id, changed_at desc);
create index on public.sales_orders (estado, created_at desc);
create index on public.sales_orders (vendedor_id);
create index on public.sales_orders (cliente_documento);
create index on public.order_items (order_id);
create index on public.payments (order_id);
create index on public.warranties (vehicle_id);
create index on public.warranties (order_id);
create index on public.warranty_claims (warranty_id);
