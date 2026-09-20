import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { snapWallPoint } from '@/canvas/editor-v2/snap-candidates';
import { clickWallDraw } from '@/canvas/editor-v2/wall-draw-machine';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { wallPoints } from '@/lib/editor-document/geometry';

const chain = () => addWallPath(emptyEditorDocument(), [
  { x: 1000, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 },
]);
const anchor = { x: 0, y: 4000 };
describe('intelligent room closure', () => {
  it('extends the initial short wall with shared vertex and a single undo', () => {
    const doc = chain(), snapshot = structuredClone(doc), store = createEditorStore(doc);
    const snap = snapWallPoint(doc, { x: 20, y: 30 }, .08, true, anchor);
    expect(snap.kind).toBe('extension');
    expect(snap.point).toEqual({ x: 0, y: 0 });
    const result = clickWallDraw({ anchor, preview: snap.point }, snap.point, doc, snap.extension);
    expect(result.state.anchor).toBeNull();
    store.getState().apply(result.document!);
    expect(store.getState().document.walls).toHaveLength(4);
    expect(store.getState().document.vertices).toHaveLength(4);
    expect(store.getState().document.walls[0]!.id).toBe(doc.walls[0]!.id);
    expect(deriveRooms(store.getState().document)[0]!.areaMm2).toBe(20e6);
    expect(doc).toEqual(snapshot);
    store.getState().undo(); expect(store.getState().document).toEqual(snapshot);
    store.getState().redo(); expect(store.getState().document.walls).toHaveLength(4);
  });
  it('preserves door physical position when extending either oriented end', () => {
    for (const reverse of [false, true]) {
      let doc = chain();
      const wall = doc.walls[0]!;
      if (reverse) [wall.startVertexId, wall.endVertexId] = [wall.endVertexId, wall.startVertexId];
      doc = addOpening(doc, wall.id, { x: 3000, y: 0 }, 'puerta');
      const snap = snapWallPoint(doc, { x: 0, y: 0 }, .08, true, anchor);
      const result = clickWallDraw({ anchor, preview: snap.point }, snap.point, doc, snap.extension).document!;
      const opening = result.openings[0]!, [a, b] = wallPoints(result, result.walls[0]!);
      expect(a.x + (b.x - a.x) * opening.position).toBeCloseTo(3000);
      expect(opening.id).toBe(doc.openings[0]!.id);
    }
  });
  it('uses screen tolerance, respects disabled snap and does not mutate on preview', () => {
    const doc = chain(), snapshot = structuredClone(doc);
    for (const scale of [.015, .08, .5]) {
      expect(snapWallPoint(doc, { x: -11 / scale, y: 0 }, scale, true, anchor).kind).toBe('extension');
      expect(snapWallPoint(doc, { x: -13 / scale, y: 0 }, scale, true, anchor).kind).not.toBe('extension');
    }
    expect(snapWallPoint(doc, { x: 0, y: 0 }, .08, false, anchor).kind).toBe('free');
    expect(doc).toEqual(snapshot);
  });
  it('never extends an unrelated wall or moves a shared vertex', () => {
    let doc = addWallPath(emptyEditorDocument(), [{ x: 1000, y: 0 }, { x: 5000, y: 0 }]);
    expect(snapWallPoint(doc, { x: 0, y: 0 }, .08, true, anchor).extension).toBeUndefined();
    doc = addWallPath(chain(), [{ x: 1000, y: 0 }, { x: 1000, y: -2000 }]);
    expect(snapWallPoint(doc, { x: 0, y: 0 }, .08, true, anchor).extension).toBeUndefined();
  });
});
