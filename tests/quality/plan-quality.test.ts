/**
 * Puerta que el agente aplica al plano leído de una imagen: solo la banda alta
 * lo entrega como fiel; confirmar, bloquear o no poder evaluar lo marcan como
 * aproximado, con sus motivos para el usuario.
 */
import { describe, expect, it } from 'vitest';
import { applyPlanQuality } from '@/lib/plan-quality';
import type { Plano2dPayload } from '@/lib/contracts';

const PLANO: Plano2dPayload = {
  schemaVersion: 1,
  zones: [
    {
      id: 'z1',
      name: 'Salón',
      outline: [
        { x: 0, y: 0 },
        { x: 3000, y: 0 },
        { x: 3000, y: 3000 },
      ],
      walls: [],
      apertures: [],
      dimensions: [],
    },
  ],
};

describe('applyPlanQuality', () => {
  it('con fiabilidad alta el plano se entrega como fiel', () => {
    const plano = applyPlanQuality(PLANO, { score: 96, decision: 'proceed', reasons: [] });
    expect(plano.aproximado).toBeUndefined();
    expect(plano.calidad).toEqual({ score: 96, decision: 'proceed', motivos: [] });
    expect(plano.zones).toEqual(PLANO.zones);
  });

  it('con dudas el plano queda marcado como aproximado con sus motivos', () => {
    const plano = applyPlanQuality(PLANO, {
      score: 70,
      decision: 'confirm',
      reasons: ['Las medidas calculadas no cuadran con las cotas escritas en el plano.'],
    });
    expect(plano.aproximado).toBe(true);
    expect(plano.calidad?.motivos).toHaveLength(1);
  });

  it('con fiabilidad baja el plano nunca se presenta como fiel', () => {
    const plano = applyPlanQuality(PLANO, { score: 30, decision: 'block', reasons: ['Muros incoherentes.'] });
    expect(plano.aproximado).toBe(true);
    expect(plano.calidad?.decision).toBe('block');
  });

  it('sin evaluación posible (fail-closed) tampoco se da por fiel', () => {
    const plano = applyPlanQuality(PLANO, {
      score: null,
      decision: 'confirm',
      reasons: ['No se pudo evaluar la calidad con Jev; confirma antes de seguir para no gastar de más.'],
    });
    expect(plano.aproximado).toBe(true);
    expect(plano.calidad?.score).toBeNull();
  });
});
