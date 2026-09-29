import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { alignKitchenRunToWall } from '@/canvas/editor-v2/wall-back-alignment';
import { kitchenRunDefaults } from '@/lib/editor-document/kitchen-run-types';
import { localToWorld } from '@/lib/editor-document/spatial-properties';

// Muro de 150 mm casi vertical con 0,18° de inclinación: cara interior (lado -x) a 75 mm del eje.
const wall = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 29, y: 9076 }], false);
const wallAngle = Math.atan2(9076, 29) * 180 / Math.PI;
/** Distancia de un punto a la cara interior del muro, medida en perpendicular. */
const faceGap = (p: { x: number; y: number }) => {
  const length = Math.hypot(29, 9076), ux = 29 / length, uy = 9076 / length;
  return (p.x * -uy + p.y * ux) - 75;
};

describe('tramo de cocina contra un muro inclinado', () => {
  it('gira lo justo y apoya toda la trasera en la cara del muro', () => {
    const run = kitchenRunDefaults({ id: 'run', x: -55, y: 1000, widthMm: 3000, rotation: 90.035 });
    const aligned = alignKitchenRunToWall(wall(), run, 150);
    expect(aligned.rotation).toBeCloseTo(wallAngle, 1);
    const [start, end] = [0, aligned.widthMm].map((x) => localToWorld(aligned, { x, y: 0 }));
    expect(Math.abs(faceGap(start!))).toBeLessThan(.5);
    expect(Math.abs(faceGap(end!))).toBeLessThan(.5);
  });

  it('no cambia de muro: si exigiría un giro grande se queda como está', () => {
    const run = kitchenRunDefaults({ id: 'run', x: -55, y: 1000, widthMm: 3000, rotation: 0 });
    expect(alignKitchenRunToWall(wall(), run, 150)).toBe(run);
  });

  it('sin muro cercano no se mueve', () => {
    const run = kitchenRunDefaults({ id: 'run', x: 4000, y: 1000, widthMm: 3000, rotation: 90.035 });
    expect(alignKitchenRunToWall(wall(), run, 150)).toBe(run);
  });
});
