import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { applyCommand } from '@/lib/editor-document/commands';
import { toCanvasV1 } from '@/lib/editor-document/adapters/to-canvas-v1';

function fixture() {
  const doc = emptyEditorDocument();
  doc.calibration = { mmPerPixel: 10 };
  doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 3000, y: 0 }, { id: 'c', x: 6000, y: 0 }];
  doc.walls = [
    { id: 'w', startVertexId: 'a', endVertexId: 'b', thicknessMm: 150, dimensionalOrigin: 'raster' },
    { id: 'w2', startVertexId: 'c', endVertexId: 'b', thicknessMm: 150, dimensionalOrigin: 'raster' },
  ];
  doc.openings = [{ id: 'o', wallId: 'w2', kind: 'puerta', position: 0.5, widthMm: 800, dimensionalOrigin: 'raster' }];
  const modern = upgradeConstructionDocument(doc);
  modern.walls[0]!.materials = { left: 'white', right: 'brick' };
  modern.walls[1]!.materials = { left: 'brick', right: 'white' };
  return modern;
}
describe('construction integration with canonical geometry', () => {
  it('materializes v2 opening defaults only for an explicit orientation-changing edit', () => {
    const legacy = emptyEditorDocument();
    legacy.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 3000, y: 0 }];
    legacy.walls = [{ id: 'w', startVertexId: 'a', endVertexId: 'b', thicknessMm: 150, dimensionalOrigin: 'physical' }];
    legacy.openings = [{ id: 'o', wallId: 'w', kind: 'puerta', position: 0.25, widthMm: 800, dimensionalOrigin: 'physical' }];
    const before = structuredClone(legacy);
    const inverted = applyCommand(legacy, { type: 'invert-wall', wallId: 'w' });
    expect(inverted.schemaVersion).toBe(3);
    expect(inverted.openings[0]).toMatchObject({ position: 0.75, hinge: 'right', swing: 'right' });
    expect(applyCommand(inverted, { type: 'invert-wall', wallId: 'w' })).toEqual(upgradeConstructionDocument(legacy));
    expect(legacy).toEqual(before);
    const bare = { ...legacy, openings: [] };
    expect(applyCommand(bare, { type: 'invert-wall', wallId: 'w' }).schemaVersion).toBe(2);
    const unrelated = structuredClone(legacy);
    unrelated.vertices.push({ id: 'c', x: 3000, y: 3000 });
    unrelated.walls.push({ id: 'w2', startVertexId: 'b', endVertexId: 'c', thicknessMm: 150, dimensionalOrigin: 'physical' });
    expect(applyCommand(unrelated, { type: 'invert-wall', wallId: 'w2' }).schemaVersion).toBe(2);
  });
  it('materializes v2 defaults before merging a reversed host', () => {
    const modern = fixture();
    const legacy = emptyEditorDocument();
    legacy.vertices = modern.vertices;
    legacy.walls = modern.walls.map(({ id, startVertexId, endVertexId, thicknessMm, dimensionalOrigin }) =>
      ({ id, startVertexId, endVertexId, thicknessMm, dimensionalOrigin }));
    legacy.openings = [{ id: 'o', wallId: 'w2', kind: 'puerta', position: 0.5, widthMm: 800, dimensionalOrigin: 'physical' }];
    const merged = applyCommand(legacy, { type: 'merge-walls', wallId: 'w', otherWallId: 'w2' });
    expect(merged.schemaVersion).toBe(3);
    expect(merged.openings[0]).toMatchObject({ wallId: 'w', position: 0.75, hinge: 'right', swing: 'right' });
    expect(legacy.schemaVersion).toBe(2);
    expect(legacy.openings[0]!.hinge).toBeUndefined();
  });
  it('inverts wall faces and opening axes without moving the physical door', () => {
    const source = fixture();
    const before = structuredClone(source);
    const inverted = applyCommand(source, { type: 'invert-wall', wallId: 'w2' });
    expect(inverted.walls[1]!.materials).toEqual({ left: 'white', right: 'brick' });
    expect(inverted.openings[0]).toMatchObject({ hinge: 'right', swing: 'right', openAngleDeg: 90 });
    expect(applyCommand(inverted, { type: 'invert-wall', wallId: 'w2' })).toEqual(source);
    expect(source).toEqual(before);
  });
  it('merges opposite orientations with consistent physical materials and door orientation', () => {
    const source = fixture();
    const merged = applyCommand(source, { type: 'merge-walls', wallId: 'w', otherWallId: 'w2' });
    expect(merged.walls[0]).toMatchObject({ startVertexId: 'a', endVertexId: 'c', materials: { left: 'white', right: 'brick' } });
    expect(merged.openings[0]).toMatchObject({ wallId: 'w', position: 0.75, hinge: 'right', swing: 'right' });
    expect(source.openings[0]!.wallId).toBe('w2');
  });
  it('preserves the retained first wall direction when merging at its start', () => {
    const source = fixture();
    const merged = applyCommand(source, { type: 'merge-walls', wallId: 'w2', otherWallId: 'w' });
    expect(merged.walls[0]).toMatchObject({ startVertexId: 'c', endVertexId: 'a', materials: { left: 'brick', right: 'white' } });
    expect(merged.openings[0]).toMatchObject({ position: 0.25, hinge: 'left', swing: 'left' });
  });
  it('rejects merges losing height or oriented material transitions', () => {
    const height = fixture();
    height.walls[1]!.heightMm = 2800;
    expect(() => applyCommand(height, { type: 'merge-walls', wallId: 'w', otherWallId: 'w2' })).toThrow('incompatibles');
    const material = fixture();
    material.walls[1]!.materials!.left = 'other';
    expect(() => applyCommand(material, { type: 'merge-walls', wallId: 'w', otherWallId: 'w2' })).toThrow('incompatibles');
  });
  it('splits with independent materials and merges back without losing construction fields', () => {
    const source = fixture();
    const split = applyCommand(source, { type: 'split-wall', wallId: 'w', position: 0.5, vertexId: 'm', newWallId: 'w3' });
    expect(split.walls[0]!.materials).not.toBe(split.walls[2]!.materials);
    expect(applyCommand(split, { type: 'merge-walls', wallId: 'w', otherWallId: 'w3' })).toEqual(source);
  });
  it('recalibrates plan XY and raster dimensions but never construction elevations or stair dimensions', () => {
    const source = fixture();
    source.stairs = [{ id: 's', kind: 'straight', catalogId: 'stair', materialId: 'wood', x: 100, y: 200,
      widthMm: 1000, depthMm: 3000, heightMm: 2700, elevationMm: 200, stepCount: 15, rotation: 30 }];
    const scaled = applyCommand(source, { type: 'recalibrate', factor: 2 });
    expect(scaled.walls[0]).toMatchObject({ thicknessMm: 300, heightMm: 2700 });
    expect(scaled.openings[0]).toMatchObject({ widthMm: 1600, heightMm: 2100, elevationMm: 0 });
    expect(scaled.stairs![0]).toEqual({ ...source.stairs[0], x: 200, y: 400 });
    expect(source.vertices[1]!.x).toBe(3000);
  });
  it('fails closed on all v3 legacy downgrades, including empty v3 documents', () => {
    expect(() => toCanvasV1(fixture())).toThrow('constructivas v3');
    expect(() => toCanvasV1(upgradeConstructionDocument(emptyEditorDocument()))).toThrow('constructivas v3');
  });
});
