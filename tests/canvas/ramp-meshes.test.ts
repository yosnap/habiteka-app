import { describe, expect, it } from 'vitest';
import type { Ramp } from '@/lib/editor-document/schema';
import { rampMesh } from '@/canvas/editor-v2/scene/ramp-meshes';
import { rampSurfaceGeometry } from '@/canvas/editor-v2/scene/ramp-prism';
import { BufferGeometry, BufferAttribute, Vector3 } from 'three';

const ramp: Ramp = {
  id: 'ramp', catalogId: 'builtin:ramp-straight', x: 0, y: 0, widthMm: 1200, depthMm: 5000,
  riseMm: 1200, elevationMm: 0, rotation: 0, materialId: 'concrete-grey',
  route: { landingMm: 1200, turn: 'right', secondDepthMm: 3000, secondRiseMm: 600 },
};

describe('ramp scene meshes', () => {
  it('mapea toda la textura y orienta la iluminación hacia arriba sobre la pendiente', () => {
    const surface = rampSurfaceGeometry(1.2, 5, 1.2, 1);
    expect([...surface.uvs]).toEqual([0, 1, 1, 1, 1, 0, 0, 0]);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(surface.vertices, 3));
    geometry.setIndex(new BufferAttribute(surface.indices, 1));
    geometry.computeVertexNormals();
    const expected = new Vector3(0, 5, 1.2).normalize();
    for (let i = 0; i < 4; i++) {
      const actual = new Vector3().fromBufferAttribute(geometry.getAttribute('normal'), i);
      const supplied = new Vector3().fromArray(surface.normals, i * 3);
      expect(actual.dot(expected)).toBeCloseTo(1);
      expect(supplied.dot(expected)).toBeCloseTo(1);
    }
    geometry.dispose();
  });
  it('construye un descansillo macizo desde la cota base 0 hasta su cota superior', () => {
    const landing: Ramp = { ...ramp, id: 'landing', catalogId: 'builtin:ramp-landing', depthMm: 1200,
      riseMm: 0, elevationMm: 1000, route: undefined };
    const mesh = rampMesh(landing)[0]!;
    expect(mesh.position[1]).toBe(0);
    expect(mesh.baseHeight).toBe(1);
    expect(mesh.rise).toBe(0);
  });
  it('deriva el pavimento de los mismos cuatro vértices de la cara superior', () => {
    const surface = rampSurfaceGeometry(1.2, 5, 1.2, 0);
    expect([...surface.vertices]).toHaveLength(12);
    expect(surface.vertices[1]).toBeCloseTo(1.2005);
    expect(surface.vertices[4]).toBeCloseTo(1.2005);
    expect(surface.vertices[7]).toBeCloseTo(.0005);
    expect(surface.vertices[10]).toBeCloseTo(.0005);
  });
  it('places the turned flight at its rotated 2D centre and at the landing elevation', () => {
    const second = rampMesh(ramp)[2]!;
    expect(second.position[0]).toBeCloseTo(2.7);
    expect(second.position[1]).toBeCloseTo(0);
    expect(second.baseHeight).toBeCloseTo(1.2);
    expect(second.position[2]).toBeCloseTo(-.6);
    expect(second.rotation).toBeCloseTo(-Math.PI / 2);
    expect(second.floorFinish).toMatchObject({ texture: 'none', color: '#a6a6a0' });
  });
});
