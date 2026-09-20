import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isReadyForDelivery,
  isDetectionConfirmed,
  assertTransition,
  previousPhase,
} from '@/server/agent/state-machine';
import type { Collected } from '@/lib/contracts';

const confirmed: Collected = {
  estilo: 'moderno',
  entregables: ['plano2d'],
  detected: { walls: 4, doors: 1, windows: 2, pillars: 0 },
};

describe('state-machine — transiciones y guardas', () => {
  it('solo permite las transiciones del grafo de fases', () => {
    expect(canTransition('ingesta', 'cualificacion')).toBe(true);
    expect(canTransition('cualificacion', 'entrega')).toBe(true);
    expect(canTransition('feedback', 'entrega')).toBe(true);
    expect(canTransition('feedback', 'addons')).toBe(true);
    // Saltos no permitidos:
    expect(canTransition('ingesta', 'entrega')).toBe(false);
    expect(canTransition('cualificacion', 'addons')).toBe(false);
  });

  it('isReadyForDelivery exige estilo y al menos un entregable', () => {
    expect(isReadyForDelivery({ estilo: 'moderno', entregables: ['render3d'] })).toBe(true);
    expect(isReadyForDelivery({ entregables: ['render3d'] })).toBe(false);
    expect(isReadyForDelivery({ estilo: 'moderno', entregables: [] })).toBe(false);
  });

  it('isDetectionConfirmed comprueba que hay detección registrada', () => {
    expect(isDetectionConfirmed(confirmed)).toBe(true);
    expect(isDetectionConfirmed({ entregables: [] })).toBe(false);
  });

  it('assertTransition a entrega sin estilo lanza legal_block', () => {
    expect(() =>
      assertTransition('cualificacion', 'entrega', { entregables: ['plano2d'] }),
    ).toThrowError(/estilo/);
    try {
      assertTransition('cualificacion', 'entrega', { entregables: [] });
    } catch (e) {
      expect((e as { kind: string }).kind).toBe('legal_block');
    }
  });

  it('assertTransition de ingesta sin confirmar la detección lanza not_confirmed', () => {
    try {
      assertTransition('ingesta', 'cualificacion', { entregables: [] });
    } catch (e) {
      expect((e as { kind: string }).kind).toBe('not_confirmed');
    }
  });

  it('assertTransition de un salto inválido lanza phase_guard', () => {
    try {
      assertTransition('ingesta', 'entrega', confirmed);
    } catch (e) {
      expect((e as { kind: string }).kind).toBe('phase_guard');
    }
  });

  it('assertTransition válida no lanza', () => {
    expect(() => assertTransition('cualificacion', 'entrega', confirmed)).not.toThrow();
    expect(() => assertTransition('ingesta', 'cualificacion', confirmed)).not.toThrow();
  });

  it('previousPhase devuelve el paso anterior de las fases de reposo (o null)', () => {
    expect(previousPhase('cualificacion')).toBe('ingesta');
    expect(previousPhase('feedback')).toBe('cualificacion');
    // Sin anterior: ingesta es el inicio; entrega/addons no son puntos de retorno.
    expect(previousPhase('ingesta')).toBeNull();
    expect(previousPhase('entrega')).toBeNull();
    expect(previousPhase('addons')).toBeNull();
  });
});
