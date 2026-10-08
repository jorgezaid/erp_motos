import { describe, expect, it } from 'vitest';
import { siguientesEstados, textoVigencia } from './garantias';

describe('reclamos: máquina de estados (SPEC M7, D27)', () => {
  it('abierto → en revisión → aprobado o rechazado → cerrado', () => {
    expect(siguientesEstados('abierto')).toEqual(['en_revision']);
    expect(siguientesEstados('en_revision')).toEqual(['aprobado', 'rechazado']);
    expect(siguientesEstados('aprobado')).toEqual(['cerrado']);
    expect(siguientesEstados('rechazado')).toEqual(['cerrado']);
    expect(siguientesEstados('cerrado')).toEqual([]);
  });
});

describe('vigencia de la garantía (SPEC M7: vigente y días restantes)', () => {
  it('vigente con días, vencida o anulada', () => {
    expect(textoVigencia({ vigente: true, anulada: false, dias_restantes: 120 })).toBe('Vigente · 120 días restantes');
    expect(textoVigencia({ vigente: true, anulada: false, dias_restantes: 1 })).toBe('Vigente · 1 día restante');
    expect(textoVigencia({ vigente: false, anulada: false, dias_restantes: 0 })).toBe('Vencida');
    expect(textoVigencia({ vigente: false, anulada: true, dias_restantes: 0 })).toBe('Anulada');
  });
});
