import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { upgradeSpatialDocument, objectCenter } from '@/lib/editor-document/spatial-properties';
import { updateFurniture, paintElement, saveComment } from '@/lib/editor-document/spatial-commands';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { deleteEntities, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { applyCommand } from '@/lib/editor-document/commands';
import { commentAnchor } from '@/lib/editor-document/comment-anchor';
import { readDocumentInput, documentFingerprint } from '@/server/editor/document-input';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';

export function spatialFixture() {
  const doc = emptyEditorDocument();
  const f: Furniture = { id: 'f', kind: 'cama', x: 500, y: 500, widthMm: 1000, depthMm: 2000, rotation: 0, dimensionalOrigin: 'physical' };
  doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 5000, y: 0 }];
  doc.walls = [{ id: 'w', startVertexId: 'a', endVertexId: 'b', thicknessMm: 150, dimensionalOrigin: 'physical' }];
  doc.openings = [{ id: 'o', wallId: 'w', kind: 'ventana', widthMm: 1000, position: .5, dimensionalOrigin: 'physical' }];
  doc.furniture = [f]; return doc;
}
describe('spatial v4', () => {
  it('preserves historical reads/fingerprints and equivalent 3D defaults', () => {
    for (const doc of [spatialFixture(), upgradeConstructionDocument(spatialFixture())]) {
      const fingerprint = documentFingerprint(doc), scene = editorDocumentToScene(doc);
      const modern = upgradeSpatialDocument(doc);
      expect(modern.schemaVersion).toBe(4);
      expect(editorDocumentToScene(modern)).toEqual(scene);
      expect(documentFingerprint(readDocumentInput(doc))).toBe(fingerprint);
      expect(upgradeSpatialDocument(modern)).toEqual(modern);
      expect(upgradeConstructionDocument(modern)).toEqual(modern);
    }
  });
  it('keeps center through repeated rotation and dimensions without drift', () => {
    let doc = spatialFixture(); const center = objectCenter(doc.furniture[0]!);
    for (const rotation of [37, 90, 0, -5, 360]) {
      doc = updateFurniture(doc, 'f', { rotation, widthMm: 1800 });
      expect(objectCenter(doc.furniture[0]!).x).toBeCloseTo(center.x, 8);
      expect(objectCenter(doc.furniture[0]!).y).toBeCloseTo(center.y, 8);
    }
  });
  it('persists height, elevation, finishes, and comments through JSON, undo and redo', () => {
    const store = createEditorStore(spatialFixture());
    store.getState().apply(updateFurniture(store.getState().document, 'f', { heightMm: 750, elevationMm: 300 }));
    store.getState().apply(paintElement(store.getState().document, 'o', 'frame', '#123456'));
    store.getState().apply(saveComment(store.getState().document, { id: 'c', targetEntityId: 'o', anchor: { x: .5, y: .5 }, text: '<script>alert(1)</script>' }));
    const saved = readDocumentInput(JSON.parse(JSON.stringify(store.getState().document)));
    expect(saved.comments![0]!.text).toBe('<script>alert(1)</script>');
    const box = editorDocumentToScene(saved).boxes.find((b) => b.role === 'furniture')!;
    expect(box.size[1]).toBe(.75); expect(box.position[1]).toBe(.675);
    store.getState().undo(); expect(store.getState().document.comments).toEqual([]);
    store.getState().redo(); expect(store.getState().document).toEqual(saved);
    store.getState().apply(deleteEntities(saved, ['w'])); expect(store.getState().document.comments).toEqual([]);
    store.getState().undo(); expect(store.getState().document).toEqual(saved);
  });
  it('rejects unknown fields, invalid colors, missing references and limits', () => {
    const doc = upgradeSpatialDocument(spatialFixture());
    expect(() => paintElement(doc, 'o', 'frame', 'url(evil)')).toThrow('Color');
    expect(() => saveComment(doc, { id: 'c', targetEntityId: 'missing', anchor: { x: .5, y: .5 }, text: 'hola' })).toThrow();
    expect(() => saveComment(doc, { id: 'c', targetEntityId: 'f', anchor: { x: 2, y: .5 }, text: 'hola' })).toThrow();
    expect(() => saveComment(doc, { id: 'c', targetEntityId: 'f', anchor: { x: .5, y: .5 }, text: 'a'.repeat(2001) })).toThrow();
    expect(() => parseEditorDocument({ ...doc, schemaVersion: 3 })).toThrow();
    expect(() => updateFurniture(doc, 'f', { elevationMm: -1 })).toThrow();
    const readonly = createEditorStore(doc, { readOnly: true });
    expect(() => readonly.getState().apply(paintElement(doc, 'w', 'left', '#aabbcc'))).toThrow('lectura');
  });
  it('keeps comment position when reversing/splitting/merging walls', () => {
    let doc = saveComment(spatialFixture(), { id: 'c', targetEntityId: 'w', anchor: { x: .8, y: .5 }, text: 'Esquina' });
    const anchor = commentAnchor(doc, doc.comments![0]!);
    doc = applyCommand(doc, { type: 'invert-wall', wallId: 'w' });
    expect(commentAnchor(doc, doc.comments![0]!)).toEqual(anchor);
    doc = applyCommand(doc, { type: 'split-wall', wallId: 'w', position: .75, vertexId: 'v', newWallId: 'w2' });
    expect(commentAnchor(doc, doc.comments![0]!)).toEqual(anchor);
    doc = applyCommand(doc, { type: 'merge-walls', wallId: 'w', otherWallId: 'w2' });
    expect(commentAnchor(doc, doc.comments![0]!)).toEqual(anchor);
    expect(() => addWallPath(doc, [{ x: 8000, y: 8000 }, { x: 9000, y: 8000 }])).not.toThrow();
  });
});
