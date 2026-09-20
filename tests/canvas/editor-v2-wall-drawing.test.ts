import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath, addOpening } from '@/canvas/editor-v2/editing-operations';
import { addWallSegment, clickWallDraw, idleWallDraw, moveWallDraw } from '@/canvas/editor-v2/wall-draw-machine';
import { snapWallPoint } from '@/canvas/editor-v2/snap-candidates';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { wallPoints } from '@/lib/editor-document/geometry';

describe('chained wall drawing', () => {
  it('starts without mutation and pointer movement is only a preview', () => {
    const document = emptyEditorDocument();
    const result = clickWallDraw(idleWallDraw(), { x: 0, y: 0 }, document);
    expect(result.document).toBeUndefined();
    expect(moveWallDraw(result.state, { x: 5000, y: 0 }).preview?.x).toBe(5000);
    expect(document.walls).toHaveLength(0);
  });
  it('closes an exact shared-ID rectangle and undo preserves earlier committed segments', () => {
    const store = createEditorStore(emptyEditorDocument());
    let state = idleWallDraw();
    for (const point of [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }, { x: 0, y: 0 }]) {
      const result = clickWallDraw(state, point, store.getState().document);
      if (result.document) store.getState().apply(result.document);
      state = result.state;
    }
    state = idleWallDraw(); // Escape/double click finish never modify the document.
    expect(state.anchor).toBeNull();
    expect(store.getState().document.vertices).toHaveLength(4);
    expect(deriveRooms(store.getState().document)).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().document.walls).toHaveLength(3);
    store.getState().redo();
    expect(store.getState().document.walls).toHaveLength(4);
  });
  it('ignores the repeated click of a double click without a zero-length wall', () => {
    const doc = emptyEditorDocument();
    const state = clickWallDraw(idleWallDraw(), { x: 0, y: 0 }, doc).state;
    expect(clickWallDraw(state, { x: 0, y: 0 }, doc).document).toBeUndefined();
  });
  it('splits a T host atomically and preserves opening world position', () => {
    let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }]);
    doc = addOpening(doc, doc.walls[0]!.id, { x: 4500, y: 0 }, 'puerta');
    const result = addWallSegment(doc, { x: 3000, y: 0 }, { x: 3000, y: 3000 });
    expect(result.walls).toHaveLength(3);
    expect(result.vertices).toHaveLength(4);
    const opening = result.openings[0]!;
    const [a, b] = wallPoints(result, result.walls.find((w) => w.id === opening.wallId)!);
    expect(a.x + (b.x - a.x) * opening.position).toBe(4500);
    expect(doc.walls).toHaveLength(1);
  });
  it('rejects splitting through a door and interior crossing without mutating input', () => {
    let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }]);
    doc = addOpening(doc, doc.walls[0]!.id, { x: 3000, y: 0 }, 'puerta');
    const snapshot = structuredClone(doc);
    expect(() => addWallSegment(doc, { x: 3000, y: 0 }, { x: 3000, y: 3000 })).toThrow(/abertura/);
    expect(() => addWallSegment(doc, { x: 3000, y: -3000 }, { x: 3000, y: 3000 })).toThrow();
    expect(doc).toEqual(snapshot);
  });
});

describe('screen-space drawing snap', () => {
  it('picks the actual nearest vertex rather than first in the array', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    expect(snapWallPoint(doc, { x: 90, y: 30 }, .1, true).point).toEqual({ x: 100, y: 0 });
    // Remove wall candidates to isolate competing vertices.
    expect(snapWallPoint({ ...doc, walls: [] }, { x: 90, y: 30 }, .1, true).id).toBe(doc.vertices[1]!.id);
  });
  it('keeps a twelve pixel capture radius at every zoom', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }]);
    for (const scale of [.015, .08, .5]) {
      expect(snapWallPoint(doc, { x: -11 / scale, y: 0 }, scale, true).kind).toBe('vertex');
      expect(snapWallPoint(doc, { x: -13 / scale, y: 0 }, scale, true).kind).toBe('free');
    }
  });
  it('aligns orthogonally and permits free diagonals with snapping disabled', () => {
    const point = { x: 2000, y: 50 }, anchor = { x: 0, y: 0 }, doc = emptyEditorDocument();
    expect(snapWallPoint(doc, point, .1, true, anchor).point).toEqual({ x: 2000, y: 0 });
    expect(snapWallPoint(doc, point, .1, false, anchor).point).toEqual(point);
  });
});
it('no sale al conectar con un vértice si todavía no cierra recinto', () => {
  const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }]);
  const result = clickWallDraw({ anchor: { x: 4000, y: 3000 }, preview: null }, { x: 4000, y: 0 }, doc);
  expect(result.state.anchor).toEqual({ x: 4000, y: 0 });
  expect(result.document!.walls).toHaveLength(2);
});
