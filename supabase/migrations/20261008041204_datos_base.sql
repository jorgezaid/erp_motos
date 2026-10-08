-- =============================================================================
-- Datos base obligatorios (D29): márgenes x1/x3/x6 y ubicaciones iniciales.
-- Antes estaban en seed.sql, que `supabase db push` no ejecuta: en producción faltaban y, sin
-- márgenes, liquidar un lote no generaba precios. Como migración llegan con `db push`.
-- Idempotente (on conflict do nothing): no pisa valores que el admin ya haya cambiado.
-- =============================================================================

-- Márgenes objetivo (SPEC §8)
insert into public.price_margins (tipo_venta, cantidad_minima, margen_objetivo) values
  ('unidad_x1',       1, 0.45),
  ('mayorista_x3',    3, 0.35),
  ('distribuidor_x6', 6, 0.28)
on conflict (tipo_venta) do nothing;

-- Ubicaciones mencionadas en la especificación
insert into public.locations (nombre, tipo) values
  ('Almacén Central',   'almacen'),
  ('Showroom Piérola',  'showroom'),
  ('Taller de Ensamble','taller')
on conflict (nombre) do nothing;
