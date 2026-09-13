import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { assertEditorDocument } from '@/lib/editor-document/validation';
import { addGuardWallPath, addWallPath, addOpening, deleteEntities, moveEntity, repairLandingProtectionWalls, shapePoints } from '@/canvas/editor-v2/editing-operations';
import { addRamp } from '@/lib/editor-document/construction-commands';
import type { Ramp } from '@/lib/editor-document/schema';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { snapWallPoint } from '@/canvas/editor-v2/snap-candidates';
import { snapWallMove } from '@/canvas/editor-v2/wall-move-snap';

describe('editor gestures', () => {
  it.each(['L', 'U', 'T'] as const)('creates a valid closed %s room', (shape) => {
    const doc = addWallPath(emptyEditorDocument(), shapePoints(shape, { x: 0, y: 0 }), true);
    expect(deriveRooms(doc)).toHaveLength(1);
  });
  it('preserves original and deletes hosted openings together with wall', () => {
    const original = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }]);
    const doc = addOpening(original, original.walls[0]!.id, { x: 2500, y: 0 }, 'puerta');
    expect(original.openings).toHaveLength(0);
    expect(deleteEntities(doc, [doc.walls[0]!.id]).openings).toHaveLength(0);
  });
  it('moves shared vertices without disconnecting adjacent walls', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }]);
    const next = moveEntity(doc, doc.walls[0]!.id, { x: 0, y: 200 });
    expect(next.walls[0]!.endVertexId).toBe(next.walls[1]!.startVertexId);
    expect(next.vertices[1]!.y).toBe(200);
  });
  it('snaps a dragged wall endpoint to a column corner and exposes a guide', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 0, y: 1000 }]);
    doc.columns = [{ id: 'column', catalogId: 'builtin:column-rectangular', x: 1000, y: 0, widthMm: 400, depthMm: 400,
      heightMm: 2700, elevationMm: 0, rotation: 0, materialId: 'concrete-grey', color: '#a6a6a0' }];
    const snapped = snapWallMove(doc, doc.walls[0]!, { x: 850, y: 0 }, .1, true);
    expect(snapped.delta).toMatchObject({ x: 1000, y: 0 });
    expect(snapped.guides).toHaveLength(2);
  });
  it('uses every spatial element corner as a wall-drawing magnet', () => {
    const doc = emptyEditorDocument();
    doc.furniture = [{ id: 'table', kind: 'box', x: 1000, y: 2000, widthMm: 600, depthMm: 400,
      rotation: 0, dimensionalOrigin: 'physical' }];
    doc.columns = [{ id: 'column', catalogId: 'builtin:column-rectangular', x: 3000, y: 2000, widthMm: 400, depthMm: 400,
      heightMm: 2700, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' }];
    doc.stairs = [{ id: 'stair', kind: 'straight', catalogId: 'builtin:stairs-straight', x: 5000, y: 2000, widthMm: 1200,
      depthMm: 3000, heightMm: 1200, elevationMm: 0, rotation: 0, stepCount: 8, materialId: 'oak-natural' }];
    doc.ramps = [{ id: 'ramp', catalogId: 'builtin:ramp-straight', x: 7000, y: 2000, widthMm: 1200, depthMm: 3000,
      riseMm: 600, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' }];
    for (const [point, id] of [[{ x: 1010, y: 2010 }, 'table'], [{ x: 3010, y: 2010 }, 'column'],
      [{ x: 5010, y: 2010 }, 'stair'], [{ x: 7010, y: 2010 }, 'ramp']] as const)
      expect(snapWallPoint(doc, point, .1, true)).toMatchObject({ kind: 'object', point: { x: point.x - 10, y: point.y - 10 }, id });
  });
  it('restores a full marquee deletion with one undo operation', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }]);
    const store = createEditorStore(doc);
    store.getState().apply(deleteEntities(doc, doc.walls.map((wall) => wall.id)));
    expect(store.getState().document.walls).toHaveLength(0);
    store.getState().undo();
    expect(store.getState().document).toEqual(doc);
  });
  it('builds normal walls and guard walls on the finished surface of a nearby landing edge', () => {
    const landing: Ramp = { id: 'landing', catalogId: 'builtin:ramp-landing', x: 1000, y: 1000, widthMm: 1200, depthMm: 900,
      riseMm: 0, elevationMm: 1000, rotation: 0, materialId: 'concrete-grey' };
    const source = addRamp(emptyEditorDocument(), landing);
    const normal = addWallPath(source, [{ x: 1000, y: 1100 }, { x: 2200, y: 1100 }]);
    const guard = addGuardWallPath(source, [{ x: 1000, y: 1100 }, { x: 2200, y: 1100 }]);
    const normalPoints = normal.vertices.filter((vertex) => normal.walls[0]!.startVertexId === vertex.id || normal.walls[0]!.endVertexId === vertex.id);
    expect(normal.walls[0]).toMatchObject({ baseElevationMm: 1000, heightMm: 2700 });
    expect(guard.walls[0]).toMatchObject({ baseElevationMm: 1000, heightMm: 1100 });
    expect(normalPoints.map((point) => point.y)).toEqual([1075, 1075]);
    expect(snapWallPoint(source, { x: 1600, y: 1100 }, .08, true)).toMatchObject({ kind: 'landing', point: { x: 1600, y: 1075 } });
    expect(addGuardWallPath(source, [{ x: 1200, y: 1200 }, { x: 2000, y: 1700 }]).walls[0]).toMatchObject({ baseElevationMm: 1000 });
    const left = addGuardWallPath(source, [{ x: 1000, y: 1000 }, { x: 1000, y: 1900 }]);
    const top = addGuardWallPath(left, [{ x: 1000, y: 1000 }, { x: 2200, y: 1000 }]);
    expect(top.vertices.filter((vertex) => top.walls.some((wall) => wall.startVertexId === vertex.id || wall.endVertexId === vertex.id))
      .some((vertex) => vertex.x === 1075 && vertex.y === 1075)).toBe(true);
  });
  it('repairs legacy protection-wall vertices on a landing without touching full-height walls', () => {
    const landing: Ramp = { id: 'landing', catalogId: 'builtin:ramp-landing', x: 1000, y: 1000, widthMm: 1200, depthMm: 900,
      riseMm: 0, elevationMm: 1000, rotation: 0, materialId: 'concrete-grey' };
    const source = addRamp(emptyEditorDocument(), landing);
    const legacy = addWallPath(source, [{ x: 1000, y: 1075 }, { x: 1000, y: 1825 }]);
    legacy.walls[0]!.heightMm = 1100; legacy.walls[0]!.baseElevationMm = 0;
    legacy.vertices.forEach((vertex) => { vertex.x = 1000; });
    const repaired = repairLandingProtectionWalls(legacy), wall = repaired.walls[0]!;
    expect(wall).toMatchObject({ baseElevationMm: 1000 });
    expect(repaired.vertices.filter((vertex) => vertex.id === wall.startVertexId || vertex.id === wall.endVertexId).map((vertex) => vertex.x)).toEqual([1075, 1075]);
  });
  it('repairs intersecting legacy muretes before topology validation', () => {
    const landing: Ramp = { id: 'landing', catalogId: 'builtin:ramp-landing', x: 1000, y: 1000, widthMm: 1200, depthMm: 900,
      riseMm: 0, elevationMm: 1000, rotation: 0, materialId: 'concrete-grey' };
    const left = addGuardWallPath(addRamp(emptyEditorDocument(), landing), [{ x: 1000, y: 1000 }, { x: 1000, y: 1900 }]);
    const broken = addGuardWallPath(left, [{ x: 1000, y: 1000 }, { x: 2200, y: 1000 }]);
    const top = broken.walls.at(-1)!;
    broken.vertices.push({ id: 'legacy-corner', x: 1000, y: 1075 }); top.startVertexId = 'legacy-corner';
    expect(() => assertEditorDocument(broken)).not.toThrow();
    expect(() => assertEditorDocument(repairLandingProtectionWalls(broken))).not.toThrow();
  });
  it('does not make protection walls participate in room-boundary topology', () => {
    const doc = emptyEditorDocument();
    doc.schemaVersion = 3; doc.stairs = [];
    doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1000, y: 1000 }, { id: 'c', x: 0, y: 1000 }, { id: 'd', x: 1000, y: 0 }];
    doc.walls = [{ id: 'guard-a', startVertexId: 'a', endVertexId: 'b', thicknessMm: 150, dimensionalOrigin: 'physical', heightMm: 1100,
      materials: { left: 'plaster-white', right: 'plaster-white' } }, { id: 'guard-b', startVertexId: 'c', endVertexId: 'd', thicknessMm: 150,
      dimensionalOrigin: 'physical', heightMm: 1100, materials: { left: 'plaster-white', right: 'plaster-white' } }];
    expect(() => assertEditorDocument(doc)).not.toThrow();
  });
});
