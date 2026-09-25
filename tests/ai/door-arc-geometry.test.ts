import { describe, expect, it } from 'vitest';
import { credibleDoorArc, validDoorArcGeometry } from '@/server/ai/sketch/door-arc-geometry';

describe('geometría del arco en una imagen vertical', () => {
  it('mide el radio en píxeles y rechaza un falso cuarto de círculo', () => {
    const falseArc = {
      hinge: { x: 0.554, y: 0.201 },
      openingEnd: { x: 0.554, y: 0.083 },
      arcPoint: { x: 0.638, y: 0.201 },
    };
    expect(validDoorArcGeometry(falseArc, 1200 / 857)).toBeNull();
    const observedArc = {
      hinge: { x: 0.556, y: 0.205 },
      openingEnd: { x: 0.556, y: 0.262 },
      arcPoint: { x: 0.608, y: 0.246 },
    };
    expect(validDoorArcGeometry(observedArc, 1200 / 857)).toEqual(observedArc);
  });

  it('no convierte en puerta un símbolo sin arco cuando otras puertas sí tienen puntos medidos', () => {
    const walls = [{ x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.9 }];
    const observed = { tipo: 'puerta' as const, muro: 0, posicion: 0.4,
      arcGeometry: { hinge: { x: 0.5, y: 0.3 }, openingEnd: { x: 0.5, y: 0.38 },
        arcPoint: { x: 0.58, y: 0.3 } } };
    const guessed = { tipo: 'puerta' as const, muro: 0, posicion: 0.6, arcVisible: true };
    expect(credibleDoorArc(observed, [observed, guessed], walls)).toBe(true);
    expect(credibleDoorArc(guessed, [observed, guessed], walls)).toBe(false);
    expect(credibleDoorArc(guessed, [guessed], walls)).toBe(true);
  });
});
