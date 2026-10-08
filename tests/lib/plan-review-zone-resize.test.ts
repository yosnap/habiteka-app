import { describe, expect, it } from 'vitest';
import { applyReviewedWalls, resizeZoneSide, reviewedWallOverrides } from '@/lib/plan-review-geometry';
import type { PlanWall, Plano2dPayload } from '@/lib/contracts';

const wall = (id: string, x1: number, y1: number, x2: number, y2: number): PlanWall =>
  ({ id, from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, thicknessMm: 160 }) as PlanWall;

// Lavandería (0–2000) y cocina (2000–5000) comparten el muro x=2000; contornos en las caras.
const shared = wall('m', 2000, 0, 2000, 3000);
const plano = {
  schemaVersion: 1,
  zones: [
    { id: 'lav', name: 'Lavandería', apertures: [], dimensions: [],
      outline: [{ x: 80, y: 80 }, { x: 1920, y: 80 }, { x: 1920, y: 2920 }, { x: 80, y: 2920 }],
      walls: [wall('n1', 0, 0, 2000, 0), shared, wall('s1', 0, 3000, 2000, 3000), wall('o', 0, 0, 0, 3000)] },
    { id: 'coc', name: 'Cocina', apertures: [], dimensions: [],
      outline: [{ x: 2080, y: 80 }, { x: 4920, y: 80 }, { x: 4920, y: 2920 }, { x: 2080, y: 2920 }],
      walls: [wall('n2', 2000, 0, 5000, 0), shared, wall('s2', 2000, 3000, 5000, 3000), wall('e', 5000, 0, 5000, 3000)] },
  ],
} as unknown as Plano2dPayload;

const box = (result: Plano2dPayload, id: string) => {
  const xs = result.zones.find(zone => zone.id === id)!.outline.map(point => point.x);
  return Math.max(...xs) - Math.min(...xs);
};

describe('resizeZoneSide', () => {
  it('estira el ancho moviendo el muro compartido y la vecina cede lo mismo', () => {
    const resized = resizeZoneSide(plano, 'lav', 'x', 2340);
    expect(box(resized, 'lav')).toBe(2340);
    expect(box(resized, 'coc')).toBe(2840 - 500);
    const walls = new Map(resized.zones.flatMap(zone => zone.walls.map(item => [item.id, item])));
    expect(walls.get('m')!.from.x).toBe(2500);
    expect(walls.get('n1')!.to.x).toBe(2500);
    expect(walls.get('n2')!.from.x).toBe(2500);
    expect(walls.get('o')!.from.x).toBe(0);
    // Las revisiones resultantes son coherentes: las esquinas unidas siguen unidas.
    expect(() => applyReviewedWalls(plano, reviewedWallOverrides(plano, resized))).not.toThrow();
  });

  it('no cambia nada si el tamaño ya coincide', () => {
    expect(resizeZoneSide(plano, 'lav', 'x', 1840)).toBe(plano);
  });
});
