# Guía: construir este ERP con Claude Code (consola)

## 1. Qué hay en este paquete y para qué sirve

| Archivo | Para qué | ¿Quién lo lee? |
|---|---|---|
| `CLAUDE.md` | Reglas del proyecto, comandos y stack. **Claude Code lo carga solo** en cada sesión. | Claude |
| `SPEC.md` | Qué construir: reglas RN-xx, algoritmo de costeo y pantallas | Tú y Claude |
| `PROGRESS.md` | Checklist por fases, preguntas abiertas, decisiones y bitácora. Se importa en CLAUDE.md, así que Claude siempre sabe en qué van. | Tú y Claude |
| `.claude/commands/*.md` | Comandos propios: `/siguiente`, `/cerrar-sesion`, `/migracion`, `/probar`, `/revisar` | Claude |
| `.claude/settings.json` | Permisos: qué puede ejecutar sin preguntar y qué tiene prohibido (leer `.env`, `db push`, `git push`) | Claude Code |
| `supabase/` | Migraciones SQL ya probadas (Fase 1) | Supabase CLI |
| `tests/` | Pruebas SQL de las reglas de negocio | `./tests/run.sh` |

## 2. Instalación (una sola vez)

1. **Node.js 22.12 o superior** (https://nodejs.org) y **pnpm**: `npm install -g pnpm`
2. **Docker Desktop** (lo necesita la BD local de Supabase). Déjalo abierto.
3. **Supabase CLI**
   - macOS: `brew install supabase/tap/supabase`
   - Windows: `scoop install supabase`, o úsalo sin instalar con `npx supabase ...`
   - Linux: descarga el binario desde https://github.com/supabase/cli/releases
4. **psql** (para `./tests/run.sh`): viene con PostgreSQL; en macOS, `brew install libpq`.
5. **Git**, y en Windows se recomienda **WSL2** o Git Bash para ejecutar los scripts `.sh`.
6. **Claude Code**
   - macOS / Linux / WSL: `curl -fsSL https://claude.ai/install.sh | bash`
   - Windows (PowerShell): `irm https://claude.ai/install.ps1 | iex`
   - Alternativa: `npm install -g @anthropic-ai/claude-code`
   - Comprueba con `claude --version`. La primera vez que ejecutes `claude`, inicia sesión con tu cuenta.

## 3. Preparar el proyecto

```bash
unzip ev-erp-claude-code.zip && cd ev-erp
git init && git add . && git commit -m "chore: base de datos y documentación inicial"

supabase init          # si pregunta, NO sobrescribas supabase/migrations ni seed.sql
supabase start         # levanta Postgres + Auth + Studio en Docker (tarda la primera vez)
supabase db reset      # aplica las 3 migraciones + seed
./tests/run.sh         # debe terminar en: TODAS LAS PRUEBAS PASARON
```

> Si `supabase init` crea un `supabase/config.toml`, está bien. Supabase Studio queda en http://127.0.0.1:44323

## 4. Trabajar con Claude

Abre la terminal **dentro de la carpeta del proyecto** y ejecuta `claude`.

### Primera sesión: pega esto
```
Lee CLAUDE.md, SPEC.md y PROGRESS.md. Resume en 5 líneas qué entendiste del proyecto
y en qué fase estamos. Luego ayúdame a completar la Fase 0 (entorno) paso a paso.
```

### Ciclo de trabajo (para cada tarea)
```
/siguiente          → Claude toma la próxima tarea, te muestra un plan y espera tu OK
   (revisas el plan, respondes "ok" o corriges)
/probar             → si quieres volver a verificar
/revisar            → revisión de seguridad y reglas antes de hacer commit
/cerrar-sesion      → actualiza PROGRESS.md y propone el commit
git add . && git commit -m "…"
/clear              → limpia el contexto antes de la siguiente tarea
```

También puedes pedir una tarea concreta: `/siguiente 2.3`

### Prompts sugeridos por fase

**Fase 2: motor de costeo**
```
/siguiente 2.1
```
Luego `/siguiente 2.2`, `2.3`… Si quieres ser más explícito:
```
Implementa la tarea 2.2: calcularProrrateo en src/lib/costing/prorrateo.ts exactamente
según SPEC.md §7 (decimal.js, 4 decimales half-up, residuo a la línea de mayor base).
Primero escribe prorrateo.test.ts con el golden test de §7 y los 3 invariantes, y confirma que falla.
```

**Fase 3: app base**
```
/siguiente 3.1
Crea el proyecto Next.js 15 en la RAÍZ de este repo, sin borrar supabase/, tests/, docs/
ni los archivos .md. Usa pnpm, TypeScript strict, Tailwind, App Router y src/.
```

**Fases 5 a 8: pantallas**
```
/siguiente 5.4
Antes de programar, muéstrame un boceto en texto de la pantalla (secciones, columnas, botones).
```

**Nueva regla de negocio**
```
/migracion descuentos_vendedor Permitir descuento de hasta 5% al vendedor y más solo con admin
```

## 5. Consejos que ahorran tiempo (y tokens)

- **Modo plan**: pulsa `Shift+Tab` hasta ver *plan mode*. Claude analiza y propone sin tocar archivos. Úsalo en tareas grandes (pantallas y migraciones).
- **`/clear` entre tareas.** PROGRESS.md mantiene la memoria del proyecto; el historial del chat no hace falta.
- **`/compact`** si una tarea larga llena el contexto.
- **`Esc`** interrumpe a Claude; **`Esc Esc`** vuelve a un mensaje anterior para corregir el rumbo.
- **`claude --continue`** retoma la última conversación; **`claude --resume`** permite elegir una.
- **Menciona archivos con `@`**: `revisa @src/lib/costing/prorrateo.ts contra @SPEC.md`.
- **Una tarea = un commit.** Si Claude se equivoca, `git checkout .` te devuelve al último estado bueno.
- **Nunca le pegues claves reales en el chat.** Van en `.env.local`, que Claude tiene prohibido leer.
- `supabase db push` (subir a producción) y `git push` están bloqueados para Claude a propósito: hazlos tú cuando revises los cambios.

## 6. Cuando algo falla

| Síntoma | Qué hacer |
|---|---|
| `./tests/run.sh`: *connection refused* | `supabase start` (y Docker abierto). Si usas otro Postgres: `PGHOST=… PGPORT=… ./tests/run.sh` |
| Un UPDATE "no hace nada" desde la app | Es RLS filtrando en silencio: revisa el rol del usuario en `profiles` |
| "Solo un administrador puede…" | Asígnate el rol: `update public.profiles set rol='admin' where id='<uuid>';` en Studio |
| Claude quiere editar una migración vieja | Recuérdale la regla 2 de CLAUDE.md: `/migracion …` |
| Los tipos de TS no coinciden con la BD | `supabase gen types typescript --local > src/types/database.ts` |
