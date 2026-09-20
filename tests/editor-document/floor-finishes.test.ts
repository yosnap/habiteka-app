import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { floorFinish, setFloorFinish, walkableSurfaceFinish } from '@/lib/editor-document/floor-finishes';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { drawingDimension, rectangleDimensions } from '@/canvas/editor-v2/drawing-dimensions';
import { applyCommand } from '@/lib/editor-document/commands';

const room = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }], true);
describe('persistent floor finishes', () => {
  it('reutiliza la misma definición de acabado para superficies transitables', () => {
    expect(walkableSurfaceFinish('polyhaven:wood_floor')).toMatchObject({
      texture: 'polyhaven:wood_floor', tileSizeMm: 1700,
    });
    expect(walkableSurfaceFinish('concrete-grey')).toMatchObject({ texture: 'none', color: '#a6a6a0' });
  });
  it('upgrades only on edit and survives parsing, further spatial edits and scene projection', () => {
    const source = room(), id = deriveRooms(source)[0]!.id;
    floorFinish(source, id); expect(source.schemaVersion).toBe(2);
    const next = setFloorFinish(source, id, { texture: 'wood', color: '#123456', rotation: 37 });
    expect(source.floorFinishes).toBeUndefined(); expect(next.schemaVersion).toBe(5);
    expect(upgradeSpatialDocument(next)).toEqual(next);
    const restored = parseEditorDocument(JSON.parse(JSON.stringify(next)));
    expect(editorDocumentToScene(restored).polygons.find((p) => p.role === 'floor')!.floorFinish).toEqual(floorFinish(next, id));
  });
  it('supports undo/redo including the historical schema', () => {
    const doc = room(), store = createEditorStore(doc), id = deriveRooms(doc)[0]!.id;
    store.getState().apply(setFloorFinish(doc, id, { texture: 'tile' }));
    store.getState().undo(); expect(store.getState().document).toEqual(doc);
    store.getState().redo(); expect(floorFinish(store.getState().document, id).texture).toBe('tile');
  });
  it('rejects invalid finishes and missing rooms', () => {
    const doc = room(), id = deriveRooms(doc)[0]!.id;
    expect(() => setFloorFinish(doc, id, { color: 'red' })).toThrow();
    expect(() => setFloorFinish(doc, id, { tileSizeMm: 0 })).toThrow();
    expect(() => setFloorFinish(doc, 'absent', {})).toThrow();
  });
  it('preserves finish identity when moving a vertex', () => {
    const doc = room(), id = deriveRooms(doc)[0]!.id;
    const next = setFloorFinish(doc, id, { texture: 'tile' });
    next.vertices[0]!.x -= 500;
    expect(floorFinish(next, deriveRooms(next)[0]!.id).texture).toBe('tile');
  });
  it('preserves finishes across wall split and merge', () => {
    const doc = room(), id = deriveRooms(doc)[0]!.id, wallId = doc.walls[0]!.id;
    const painted = setFloorFinish(doc, id, { texture: 'wood' });
    const split = applyCommand(painted, { type: 'split-wall', wallId, position: .5, vertexId: 'vertex-new', newWallId: 'wall-new' });
    expect(floorFinish(split, deriveRooms(split)[0]!.id).texture).toBe('wood');
    const merged = applyCommand(split, { type: 'merge-walls', wallId, otherWallId: 'wall-new' });
    expect(floorFinish(merged, deriveRooms(merged)[0]!.id).texture).toBe('wood');
  });
  it('raises only the floor surface, never the enclosing walls', () => {
    const doc = room(), id = deriveRooms(doc)[0]!.id;
    const legacy = setFloorFinish(doc, id, { elevationMm: 900 });
    legacy.walls.forEach((wall) => { wall.baseElevationMm = 900; });
    const next = setFloorFinish(legacy, id, { elevationMm: 1200, texture: 'tile' });
    expect(next.walls.every((wall) => wall.baseElevationMm === undefined)).toBe(true);
    expect(floorFinish(next, id)).toMatchObject({ elevationMm: 1200, texture: 'tile' });
  });
});
describe('live drawing dimensions', () => {
  it('offsets arrows with constant screen spacing and rejects zero length', () => {
    expect(drawingDimension({ x: 0, y: 0 }, { x: 0, y: 0 }, .08)).toBeNull();
    for (const scale of [.02, .08, .3]) {
      const d = drawingDimension({ x: 0, y: 0 }, { x: 5000, y: 0 }, scale)!;
      expect((-d.from.y - 75) * scale).toBeCloseTo(36);
    }
  });
  it('shows width and depth for every rectangle drawing direction', () => {
    for (const x of [-5000, 5000]) for (const y of [-3000, 3000]) {
      const dims = rectangleDimensions({ x: 0, y: 0 }, { x, y }, .08);
      expect(dims).toHaveLength(2);
      expect(Math.hypot(dims[0]!.to.x - dims[0]!.from.x, dims[0]!.to.y - dims[0]!.from.y)).toBe(5000);
      expect(Math.hypot(dims[1]!.to.x - dims[1]!.from.x, dims[1]!.to.y - dims[1]!.from.y)).toBe(3000);
    }
  });
});
