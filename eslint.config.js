// ESLint 9 (flat config). En la tarea 3.1 se amplía con las reglas de Next.js (@next/eslint-plugin-next)
// y React, agregando bloques a este arreglo en vez de reemplazarlo.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/', '.next/', 'out/', 'coverage/', 'src/types/database.ts'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: globals.node },
  },
);
