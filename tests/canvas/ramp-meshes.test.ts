import { describe, expect, it } from 'vitest';
import type { Ramp } from '@/lib/editor-document/schema';
import { rampMesh } from '@/canvas/editor-v2/scene/ramp-meshes';

const ramp: Ramp = {
  id: 'ramp', catalogId: 'builtin:ramp-straight', x: 0, y: 0, widthMm: 1200, depthMm: 5000,
  riseMm: 1200, elevationMm: 0, rotation: 0, materialId: 'concrete-grey',
  route: { landingMm: 1200, turn: 'right', secondDepthMm: 3000, secondRiseMm: 600 },
};

describe('ramp scene meshes', () => {
  it('places the turned flight at its rotated 2D centre and at the landing elevation', () => {
    const second = rampMesh(ramp)[2]!;
    expect(second.position[0]).toBeCloseTo(2.7);
    expect(second.position[1]).toBeCloseTo(0);
    expect(second.baseHeight).toBeCloseTo(1.2);
    expect(second.position[2]).toBeCloseTo(-.6);
    expect(second.rotation).toBeCloseTo(-Math.PI / 2);
  });
});
