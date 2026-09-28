import { describe, expect, it } from 'vitest';
import { createHipRoofGeometry } from '@/components/editor-v2/scene/hip-roof-geometry';
import { hipRoofSeams } from '@/components/editor-v2/scene/hip-roof-seams';

describe('cubierta continua de la carpa', () => {
  it.each([[2.8, 4.8], [4.8, 2.8], [3, 3]])('mantiene la huella de %.1f × %.1f m sin caras degeneradas', (width, depth) => {
    const geometry = createHipRoofGeometry(width, .56, depth);
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;
    expect(min.x).toBeCloseTo(-width / 2); expect(max.x).toBeCloseTo(width / 2);
    expect(min.y).toBeCloseTo(-.28); expect(max.y).toBeCloseTo(.28);
    expect(min.z).toBeCloseTo(-depth / 2); expect(max.z).toBeCloseTo(depth / 2);
    const vertices = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
    const uvs = geometry.getAttribute('uv');
    expect(uvs.count).toBe(vertices.count);
    for (let i = 0; i < vertices.count; i += 3) {
      const ax = vertices.getX(i), ay = vertices.getY(i), az = vertices.getZ(i);
      const bx = vertices.getX(i + 1), by = vertices.getY(i + 1), bz = vertices.getZ(i + 1);
      const cx = vertices.getX(i + 2), cy = vertices.getY(i + 2), cz = vertices.getZ(i + 2);
      const ab = [bx - ax, by - ay, bz - az], ac = [cx - ax, cy - ay, cz - az];
      const cross = [ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!];
      expect(Math.hypot(...cross)).toBeGreaterThan(.0001);
      expect(Number.isFinite(normals.getY(i))).toBe(true);
      for (let corner = i; corner < i + 3; corner++) {
        expect(uvs.getX(corner)).toBeGreaterThanOrEqual(0);
        expect(uvs.getX(corner)).toBeLessThanOrEqual(1);
        expect(uvs.getY(corner)).toBeGreaterThanOrEqual(0);
        expect(uvs.getY(corner)).toBeLessThanOrEqual(1);
      }
    }
    geometry.dispose();
  });

  it.each([[2.8, 4.8], [4.8, 2.8], [3, 3]])('alinea las costuras con el tejado de %.1f × %.1f m', (width, depth) => {
    const seams = hipRoofSeams([width, .56, depth]);
    expect(seams).toHaveLength(width === depth ? 4 : 5);
    for (const [start, end] of seams) {
      expect(Math.hypot(...start.map((value, index) => value - end[index]!))).toBeGreaterThan(0);
      for (const [x, y, z] of [start, end]) {
        expect(Math.abs(x)).toBeLessThanOrEqual(width / 2);
        expect(Math.abs(z)).toBeLessThanOrEqual(depth / 2);
        expect(y).toBeGreaterThanOrEqual(-.28);
        expect(y).toBeLessThanOrEqual(.28);
      }
    }
  });
});
