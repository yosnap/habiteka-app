import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addBuildingLevel, buildingDocuments, removeBuildingLevel, switchBuildingLevel, updateBuildingLevel } from '@/lib/editor-document/building-levels';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { createEditorStore } from '@/canvas/editor-v2/store';

const source = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }]);
describe('building levels', () => {
  it('creates an isolated empty level without losing historical geometry', () => {
    const original = source(), next = addBuildingLevel(original);
    expect(original.schemaVersion).toBe(2); expect(next.walls).toHaveLength(0);
    expect(next.levels).toHaveLength(2);
    const ground = switchBuildingLevel(next, next.levels![0]!.id);
    expect(ground.walls[0]!.id).toBe(original.walls[0]!.id);
    expect(ground.levels![0]!.document).toBeUndefined();
    expect(parseEditorDocument(JSON.parse(JSON.stringify(ground)))).toEqual(ground);
  });
  it('duplicates with independent geometry and stacks according to level height', () => {
    const next = addBuildingLevel(source(), true);
    next.vertices[0]!.x -= 100;
    expect(next.levels![0]!.document!.vertices[0]!.x).toBe(0);
    const updated = updateBuildingLevel(next, next.levels![0]!.id, { heightMm: 3500 });
    expect(buildingDocuments(updated).map((l) => l.elevationMm)).toEqual([0, 3500]);
  });
  it('restores deleted level and its document with undo', () => {
    const initial = addBuildingLevel(source(), true), store = createEditorStore(initial);
    store.getState().apply(removeBuildingLevel(initial, initial.activeLevelId!));
    expect(store.getState().document.levels).toHaveLength(1);
    store.getState().undo(); expect(store.getState().document).toEqual(initial);
  });
  it('rejects nested levels, invalid heights and a missing active level', () => {
    const doc = addBuildingLevel(source());
    expect(() => updateBuildingLevel(doc, doc.activeLevelId!, { heightMm: 0 })).toThrow();
    expect(() => parseEditorDocument({ ...doc, activeLevelId: 'missing' })).toThrow();
    doc.levels![0]!.document!.levels = [];
    expect(() => parseEditorDocument(doc)).toThrow('anidadas');
  });
});
