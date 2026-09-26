import { describe, expect, it } from 'vitest';
import { walkDelta, walkPitch } from '@/components/editor-v2/scene/free-walk-input';

describe('controles de la visita libre', () => {
  it('mueve a la derecha de la cámara con D o flecha derecha, también tras girar', () => {
    expect(walkDelta(0, 0, 1, 100)).toEqual({ x: -100, y: 0 });
    expect(walkDelta(0, 0, -1, 100)).toEqual({ x: 100, y: 0 });
    const turned = walkDelta(Math.PI / 2, 0, 1, 100);
    expect(turned.x).toBeCloseTo(0);
    expect(turned.y).toBeCloseTo(100);
    expect(walkDelta(0, 1, 0, 100)).toEqual({ x: 0, y: 100 });
  });

  it('mira arriba con R o ratón hacia arriba, abajo con F y limita el ángulo', () => {
    expect(walkPitch(0, 0, 1, .5)).toBeGreaterThan(0);
    expect(walkPitch(0, 0, -1, .5)).toBeLessThan(0);
    expect(walkPitch(0, -100, 0, 0)).toBeGreaterThan(0);
    expect(walkPitch(1.3, -1000, 1, 1)).toBe(1.35);
    expect(walkPitch(-1.3, 1000, -1, 1)).toBe(-1.35);
  });
});
