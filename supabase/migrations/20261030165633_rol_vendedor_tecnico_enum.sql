-- =============================================================================
-- Rol vendedor_tecnico (D42), parte 1/2: el valor del enum
-- Va solo en esta migración: un valor nuevo de un enum no se puede usar en la misma
-- transacción en que se agrega. Las políticas y funciones que lo usan están en
-- 20261030165636_rol_vendedor_tecnico.
-- =============================================================================

alter type public.app_role add value if not exists 'vendedor_tecnico';
