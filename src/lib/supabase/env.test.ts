import { describe, expect, it } from 'vitest';
import { validarEnvSupabase } from './env';

describe('validarEnvSupabase', () => {
  it('acepta la URL y la clave anónima', () => {
    expect(validarEnvSupabase('http://127.0.0.1:44321', 'clave')).toEqual({
      url: 'http://127.0.0.1:44321',
      anonKey: 'clave',
    });
  });

  it('explica cómo crear .env.local si faltan variables', () => {
    expect(() => validarEnvSupabase(undefined, 'clave')).toThrow(/pnpm env:local/);
    expect(() => validarEnvSupabase('http://x', '')).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it('rechaza una URL inválida', () => {
    expect(() => validarEnvSupabase('no-es-url', 'clave')).toThrow(/no es una URL válida/);
  });
});
