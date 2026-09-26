---
description: Toma la próxima tarea pendiente de PROGRESS.md, la planifica e implementa
argument-hint: "[id de tarea opcional, ej. 2.2]"
---
Trabaja en la tarea **$ARGUMENTS** de PROGRESS.md. Si no se indicó ninguna, toma la primera tarea `[ ]` de la fase activa.

Sigue estos pasos:
1. Lee la tarea en PROGRESS.md y **solo** las secciones de SPEC.md que le correspondan (reglas RN-xx, §7 prorrateo, §10 pantallas).
2. Revisa el código y las migraciones existentes que vayas a tocar.
3. Presenta un **plan breve** (archivos a crear o modificar, pruebas que escribirás) y espera mi aprobación antes de programar.
4. Implementa. Escribe primero las pruebas cuando la tarea tenga lógica de negocio.
5. Verifica con `pnpm test`, `pnpm typecheck`, `pnpm lint` y, si tocaste la BD, `./tests/run.sh`. Corrige hasta que todo pase.
6. Marca la tarea como `[x]` en PROGRESS.md, actualiza "Estado actual" y resume en 3 líneas lo que hiciste.
7. Propón el mensaje de commit, pero no hagas el commit sin que te lo pida.
