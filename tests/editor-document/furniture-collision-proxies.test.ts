import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Box3, BoxGeometry, Triangle, Vector3 } from 'three';
import { expect, it, vi } from 'vitest';
import registry from '@/lib/editor-document/generated/furniture-collision-proxies.json';
import { FURNITURE_CATALOG } from '@/lib/editor-document/furniture-catalog';
import { furnitureModel } from '@/lib/editor-document/furniture-models';
import * as furnitureModels from '@/lib/editor-document/furniture-models';
import { furnitureCollisionVolumes } from '@/lib/editor-document/furniture-collision-volumes';
import { addFurniture } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { collisionVoxels } from '../../scripts/lib/model-collision-voxels';

function boxTriangles(width: number, height: number, depth: number, center: Vector3): Triangle[] {
  const geometry = new BoxGeometry(width, height, depth), triangles: Triangle[] = [];
  const position = geometry.getAttribute('position'), indices = geometry.getIndex()!;
  for (let i = 0; i < indices.count; i += 3) triangles.push(new Triangle(...[0, 1, 2].map((j) =>
    new Vector3().fromBufferAttribute(position, indices.getX(i + j)).add(center)) as [Vector3, Vector3, Vector3]));
  geometry.dispose(); return triangles;
}
it('rellena piezas cerradas incluso en los límites de la rejilla, conservando el hueco bajo un tablero', () => {
  const triangles = [...boxTriangles(1, .1, 1, new Vector3(0, .95, 0)),
    ...boxTriangles(.1, .9, .1, new Vector3(-.4, .45, -.4))];
  const bounds = new Box3(); triangles.forEach((t) => [t.a, t.b, t.c].forEach((p) => bounds.expandByPoint(p)));
  const proxy = collisionVoxels(triangles, bounds);
  const occupied = (x: number, y: number, z: number) => proxy.boxes.some(([bx, by, bz, w, d, h]) =>
    x >= bx && x < bx + w && y >= by && y < by + d && z >= bz && z < bz + h);
  expect(occupied(25, 25, 25)).toBe(false); // Aire bajo el centro del tablero.
  expect(occupied(5, 5, 25)).toBe(true); // Interior de la pata, no solo su superficie.
  expect(occupied(25, 25, 47)).toBe(true); // Interior del tablero.
  expect(occupied(25, 25, 49)).toBe(true); // Cara superior en el máximo del GLB.
});
it('todos los modelos actuales de mesa y asiento tienen sólidos vigentes derivados de su GLB', () => {
  const models = new Map(FURNITURE_CATALOG.filter((e) => ['table', 'chair', 'bench'].includes(e.profile))
    .map((e) => furnitureModel({ catalogId: e.id })).filter((m) => m !== undefined).map((m) => [m.key, m]));
  expect(models.size).toBeGreaterThan(50);
  for (const model of models.values()) {
    const proxy = registry[model.key as keyof typeof registry];
    expect(proxy, model.key).toBeDefined();
    expect(proxy.sha256).toBe(model.sha256); expect(proxy.frontRotation).toBe(model.frontRotation);
    expect(createHash('sha256').update(readFileSync(`public${model.url.split('?')[0]}`)).digest('hex')).toBe(proxy.sha256);
    expect(proxy.boxes.length, model.key).toBeGreaterThan(0);
    for (const box of proxy.boxes) for (let axis = 0; axis < 3; axis++) {
      expect(box[axis]).toBeGreaterThanOrEqual(0); expect(box[axis + 3]).toBeGreaterThan(0);
      expect(box[axis]! + box[axis + 3]!).toBeLessThanOrEqual(proxy.grid[axis]!);
    }
  }
});
it('un GLB actualizado sin proxy vigente conserva toda su envolvente, también en un alias del catálogo', () => {
  const table = addFurniture(emptyEditorDocument(), getFurnitureCatalogEntry('habiteka:furniture:mesa-comedor')!, { x: 0, y: 0 }).furniture[0]!;
  const model = furnitureModel(table)!;
  const spy = vi.spyOn(furnitureModels, 'furnitureModel').mockReturnValue({ ...model, sha256: '0'.repeat(64) });
  try { expect(furnitureCollisionVolumes(table)).toEqual([{ x: 0, y: 0, widthMm: table.widthMm, depthMm: table.depthMm,
    bottom: 0, top: table.heightMm }]); } finally { spy.mockRestore(); }
});
