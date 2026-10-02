import { describe, expect, it } from 'vitest';
import { rampBodySurfaceGeometry, rampPrismGeometry } from '@/canvas/editor-v2/scene/ramp-prism';

describe('ramp prism', () => {
  it('rises toward the arrow end used by the 2D ramp', () => {
    const { vertices } = rampPrismGeometry(1.2, 4, 1);
    expect(vertices[0]).toBeCloseTo(-.6);
    expect(vertices[1]).toBe(1);
    expect(vertices[2]).toBe(-2);
    expect(vertices[6]).toBeCloseTo(.6);
    expect(vertices[7]).toBe(0);
    expect(vertices[8]).toBe(2);
  });
  it('keeps an elevated flight solid down to the ramp base', () => {
    const { vertices } = rampPrismGeometry(1.2, 4, .4, .6);
    expect(vertices[1]).toBeCloseTo(1);
    expect(vertices[7]).toBeCloseTo(.6);
    expect(vertices[13]).toBe(0);
    expect(vertices[22]).toBe(0);
  });
  it('separa las cinco caras del cuerpo y escala sus UV en metros', () => {
    const body = rampBodySurfaceGeometry(1.2, 4, 1, .6);
    expect(body.vertices).toHaveLength(60);
    expect(body.indices).toHaveLength(30);
    [0, 1.6, 4, .6, 4, 0, 0, 0].forEach((value, index) =>
      expect(body.uvs[16 + index]).toBeCloseTo(value));
    expect([...body.normals.slice(24, 36)]).toEqual([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]);
  });
});
