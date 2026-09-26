-- Datos base obligatorios (se cargan con `supabase db reset` o manualmente)

-- Márgenes objetivo de la sección 3.3
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

-- Los modelos (XSDU-29, XSDU-31, ...) se cargan desde la app con sus fichas
-- técnicas reales: voltaje, amperaje, potencia, CBM y EXW de la proforma.

-- Primer administrador: tras registrarse en Supabase Auth, ejecutar
--   update public.profiles set rol = 'admin' where id = '<uuid-del-usuario>';
