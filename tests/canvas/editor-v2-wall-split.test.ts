import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type Stair } from '@/lib/editor-document/schema';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { createEditorStore, resolveWallSplitPoint } from '@/canvas/editor-v2/store';
import { addStair } from '@/lib/editor-document/construction-commands';
import { interpolate, wallPoints } from '@/lib/editor-document/geometry';

const base = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }]);
describe('choose wall split point', () => {
  it('splits at the chosen quarter rather than midpoint and supports one undo', () => {
    const store = createEditorStore(base()), id = store.getState().document.walls[0]!.id;
    store.getState().beginWallSplit(id);
    expect(store.getState().sequence).toBe(0);
    store.getState().commitWallSplit({ x: 1500, y: 30 }, .1);
    expect(store.getState().document.vertices.some((v) => v.x === 1500 && v.y === 0)).toBe(true);
    expect(store.getState().document.walls).toHaveLength(2);
    expect(store.getState().pendingSplitWallId).toBeNull();
    store.getState().undo(); expect(store.getState().document.walls).toHaveLength(1);
  });
  it('cancel leaves confirmed geometry and history intact', () => {
    const store = createEditorStore(base()), before = structuredClone(store.getState().document);
    store.getState().beginWallSplit(before.walls[0]!.id); store.getState().cancelWallSplit();
    expect(store.getState().document).toEqual(before); expect(store.getState().past).toHaveLength(0);
    expect(store.getState().tool).toBe('select');
  });
  it('rejects splits through openings and keeps the tool active for a corrected point', () => {
    const initial = base(), doc = addOpening(initial, initial.walls[0]!.id, { x: 4500, y: 0 }, 'puerta');
    const store = createEditorStore(doc); store.getState().beginWallSplit(doc.walls[0]!.id);
    expect(store.getState().commitWallSplit({ x: 4500, y: 0 }, .1)).toBe(false);
    expect(store.getState().error).toMatch(/abertura/); expect(store.getState().document).toEqual(doc);
    expect(store.getState().commitWallSplit({ x: 2000, y: 0 }, .1)).toBe(true);
    const next = store.getState().document, o = next.openings[0]!;
    const host = next.walls.find((w) => w.id === o.wallId)!;
    expect(interpolate(...wallPoints(next, host), o.position)).toEqual({ x: 4500, y: 0 });
  });
  it('rejects distant pointer, endpoint and readonly editing', () => {
    const doc = base(), id = doc.walls[0]!.id;
    expect(resolveWallSplitPoint(doc, id, { x: 2000, y: 1000 }, .1)).toBeNull();
    expect(resolveWallSplitPoint(doc, id, { x: 0, y: 0 }, .1)?.valid).toBe(false);
    const store = createEditorStore(doc, { readOnly: true }); store.getState().beginWallSplit(id);
    expect(store.getState().pendingSplitWallId).toBeNull();
  });
});
describe('copy stair', () => {
  it('copies properties with a fresh ID into free space as one undoable edit', () => {
    const stair: Stair = { id: 'original', kind: 'L', catalogId: 'stair-L', x: 1000, y: 2000, widthMm: 2400,
      depthMm: 4000, heightMm: 2800, elevationMm: 100, rotation: 45, stepCount: 17, materialId: 'oak-natural' };
    const store = createEditorStore(addStair(emptyEditorDocument(), stair));
    store.getState().copyStair(stair.id);
    const copy = store.getState().document.stairs![1]!;
    expect(copy).toMatchObject({ ...stair, id: expect.any(String), x: expect.any(Number), y: expect.any(Number) });
    expect(copy.id).not.toBe(stair.id);
    expect(Math.hypot(copy.x - stair.x, copy.y - stair.y)).toBeGreaterThan(300);
    expect(store.getState().selection).toEqual([copy.id]);
    store.getState().undo(); expect(store.getState().document.stairs).toEqual([stair]);
  });
});
