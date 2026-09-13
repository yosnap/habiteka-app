import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { assertSpatialPlacement, snapObject } from '@/canvas/editor-v2/spatial-placement';
import { previewVertex } from '@/canvas/editor-v2/vertex-preview';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { objectClearances } from '@/canvas/editor-v2/object-clearances';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';

function fixture() {
  const doc = emptyEditorDocument();
  doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 5000, y: 0 }, { id: 'c', x: 5000, y: 5000 }];
  doc.walls = [{ id: 'w', startVertexId: 'a', endVertexId: 'b', thicknessMm: 150, dimensionalOrigin: 'physical' },
    { id: 'w2', startVertexId: 'b', endVertexId: 'c', thicknessMm: 150, dimensionalOrigin: 'physical' }];
  doc.furniture = [{ id: 'f', kind: 'bed', x: 500, y: 500, widthMm: 1000, depthMm: 2000, rotation: 0, dimensionalOrigin: 'physical' }];
  return upgradeSpatialDocument(doc);
}
describe('placement and vertex guides', () => {
  it('rejects a bed inside a wall but allows exact face contact', () => {
    const doc = fixture(), next = structuredClone(doc);
    next.furniture[0]!.y = 0;
    expect(() => assertSpatialPlacement(doc, next)).toThrow('atraviesa');
    next.furniture[0]!.y = 75;
    expect(() => assertSpatialPlacement(doc, next)).not.toThrow();
    const snapped = snapObject(doc, { ...doc.furniture[0]!, y: 110 }, .08, true);
    expect(snapped.y).toBe(75);
  });
  it('snaps movable objects to the 10 cm X/Y grid before wall alignment', () => {
    const doc = fixture();
    const snapped = snapObject(doc, { ...doc.furniture[0]!, x: 1234, y: 1500 }, .08, true);
    expect(snapped).toMatchObject({ x: 1200, y: 1500 });
    expect(snapObject(doc, { ...doc.furniture[0]!, x: 1234, y: 1566 }, .08, false)).toMatchObject({ x: 1234, y: 1566 });
  });
  it('snaps an object origin to the start or end of a wall', () => {
    const doc = fixture();
    expect(snapObject(doc, { ...doc.furniture[0]!, x: 90, y: 60 }, .08, true)).toMatchObject({ x: 0, y: 0 });
    expect(snapObject(doc, { ...doc.furniture[0]!, x: 4910, y: 60 }, .08, true)).toMatchObject({ x: 5000, y: 0 });
  });
  it('allows plan overlap only when vertical volumes are separate', () => {
    const doc = fixture(), next = structuredClone(doc);
    next.furniture.push({ ...next.furniture[0]!, id: 'f2', elevationMm: 550 });
    expect(() => assertSpatialPlacement(doc, next)).not.toThrow();
    next.furniture[1]!.elevationMm = 500;
    expect(() => assertSpatialPlacement(doc, next)).toThrow();
  });
  it('previews all shared walls and aligns without snapping to itself', () => {
    const doc = fixture(), result = previewVertex(doc, 'b', { x: 5300, y: 20 }, .08, true);
    expect(result.point).toEqual({ x: 5300, y: 0 });
    expect(result.guides.length).toBeGreaterThan(0);
    expect(result.document.vertices.find((v) => v.id === 'b')!.x).toBe(5300);
    expect(doc.vertices.find((v) => v.id === 'b')!.x).toBe(5000);
    const store = createEditorStore(doc);
    for (let n = 1; n <= 20; n++) previewVertex(doc, 'b', { x: 5300 + n, y: 0 }, .08, true);
    expect(store.getState().past).toHaveLength(0);
    store.getState().apply(result.document); expect(store.getState().past).toHaveLength(1);
    store.getState().undo(); expect(store.getState().document).toEqual(doc);
  });
  it('marks degenerate candidates invalid without changing the source', () => {
    const doc = fixture(), result = previewVertex(doc, 'b', { x: 0, y: 0 }, .08, false);
    expect(result.error).toBeTruthy(); expect(doc.vertices[1]!.x).toBe(5000);
  });
  it('measures from object edges to wall faces, not to the wall axis', () => {
    const doc = fixture(), guides = objectClearances(doc, doc.furniture[0]!);
    expect(guides[0]).toEqual({ from: { x: 1000, y: 500 }, to: { x: 1000, y: 75 } });
  });
  it('shares table solids between 3D and placement, allowing a low object below the tabletop', () => {
    const doc = fixture();
    doc.furniture = [{ ...doc.furniture[0]!, kind: 'mesa', heightMm: 1000 }];
    const next = structuredClone(doc);
    next.furniture.push({ ...doc.furniture[0]!, id: 'low', kind: 'box', x: 800, y: 800, widthMm: 300, depthMm: 300, heightMm: 500 });
    expect(() => assertSpatialPlacement(doc, next)).not.toThrow();
    expect(editorDocumentToScene(doc).boxes.filter((b) => b.sourceEntityId === 'f')).toHaveLength(5);
    next.furniture[1]!.heightMm = 1000;
    expect(() => assertSpatialPlacement(doc, next)).toThrow();
  });
  it('previews a 200-wall / 200-object scene within the interaction budget', () => {
    const source = emptyEditorDocument();
    for (let i = 0; i < 200; i++) {
      source.vertices.push({ id: `a${i}`, x: i * 10000, y: 0 }, { id: `b${i}`, x: i * 10000 + 5000, y: 0 });
      source.walls.push({ id: `w${i}`, startVertexId: `a${i}`, endVertexId: `b${i}`, thicknessMm: 150, dimensionalOrigin: 'physical' });
      source.furniture.push({ id: `f${i}`, kind: 'bed', x: i * 10000 + 500, y: 500, widthMm: 1000, depthMm: 2000, rotation: 0, dimensionalOrigin: 'physical' });
    }
    const doc = upgradeSpatialDocument(source), times: number[] = [];
    for (let i = 0; i < 12; i++) {
      const start = performance.now();
      const result = previewVertex(doc, 'b0', { x: 5500 + i, y: -20 }, .08, true);
      expect(result.error).toBeNull(); times.push(performance.now() - start);
    }
    const p95 = times.sort((a, b) => a - b)[11]!;
    console.info(`Vertex preview 200 walls + 200 objects p95: ${p95.toFixed(2)}ms`);
    expect(p95).toBeLessThan(100);
  });
});
