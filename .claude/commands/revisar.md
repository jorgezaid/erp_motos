---
description: Revisa los cambios actuales contra SPEC.md, seguridad y convenciones
---
Revisa `git diff` (y los archivos nuevos sin seguimiento) con esta lista:
1. **Reglas de negocio**: ¿algún cambio contradice o duplica mal una RN-xx de SPEC.md?
2. **Fuga de costos**: ¿algún componente, Server Action o prop serializada expone datos de `import_batches`, `batch_items`, `batch_model_costs`, `v_vehicle_costs`, `v_price_matrix` o `v_sales_margin` a un rol que no sea admin?
3. **RLS**: ¿las tablas nuevas tienen RLS y políticas? ¿Se usa la service role key donde no hace falta?
4. **Dinero**: ¿se usa `number` en sumas o prorrateos en vez de decimal.js?
5. **Errores**: ¿se comprueban las filas afectadas en los UPDATE y DELETE (RLS silencioso)? ¿Se muestran los mensajes de la BD?
6. **Pruebas**: ¿la lógica nueva tiene pruebas que citen su RN-xx?
7. **UX**: ¿los textos están en español (es-PE) y los montos con el formato `S/`?

Entrega los hallazgos ordenados por severidad, cada uno con el archivo y la línea, y la corrección sugerida.
