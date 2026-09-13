import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { assertSpatialPlacement, snapObject } from '@/canvas/editor-v2/spatial-placement';
import { snapToAlignmentGuides } from '@/canvas/editor-v2/alignment-guides';
import { previewVertex } from '@/canvas/editor-v2/vertex-preview';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { objectClearances } from '@/canvas/editor-v2/object-clearances';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { addColumn, addRamp, addStair, updateRamp } from '@/lib/editor-document/construction-commands';
import { resizeRampFromCorner } from '@/lib/editor-document/ramp-landing-placement';
import { placeLandingAtStairArrival, placeStairAtRampArrival } from '@/lib/editor-document/stair-landing-placement';
import { addGuardWallPath, nudgeSpatialEntities } from '@/canvas/editor-v2/editing-operations';
import { parseEditorDecimal } from '@/components/editor-v2/decimal-input';

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
  it('allows a structural column on a wall and snaps its centre to the wall axis', () => {
    const column = { id: 'column', catalogId: 'builtin:column-rectangular', x: 1000, y: -200,
      widthMm: 400, depthMm: 400, heightMm: 2700, elevationMm: 0, rotation: 0, materialId: 'concrete-grey', color: '#a6a6a0' } as const;
    const doc = addColumn(fixture(), column), next = structuredClone(doc);
    next.columns![0]!.y = -150;
    expect(() => assertSpatialPlacement(doc, next)).not.toThrow();
    expect(snapObject(doc, { ...column, y: -100 }, .08, true)).toMatchObject({ x: 1000, y: -200 });
  });
  it('aligns a column to construction edges without pulling it off a wall axis', () => {
    const column = { id: 'column', catalogId: 'builtin:column-rectangular', x: 1800, y: 2700,
      widthMm: 400, depthMm: 400, heightMm: 2700, elevationMm: 0, rotation: 0, materialId: 'concrete-grey', color: '#a6a6a0' } as const;
    const landing = { id: 'landing', catalogId: 'builtin:ramp-landing', x: 2000, y: 3000, widthMm: 1200, depthMm: 1200,
      riseMm: 0, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' } as const;
    const doc = addRamp(addColumn(fixture(), column), landing);
    expect(snapObject(doc, { ...column, x: 1810, y: 2710 }, .08, true)).toMatchObject({ x: 1800, y: 2600 });
  });
  it('allows ramps, landings and stairs to integrate with a column but blocks furniture', () => {
    const column = { id: 'column', catalogId: 'builtin:column-rectangular' as const, x: 2000, y: 2000,
      widthMm: 400, depthMm: 400, heightMm: 2700, elevationMm: 0, rotation: 0, materialId: 'concrete-grey', color: '#a6a6a0' };
    const source = addColumn(fixture(), column);
    const ramp = addRamp(source, { id: 'ramp', catalogId: 'builtin:ramp-straight', x: 1800, y: 1800,
      widthMm: 1200, depthMm: 3000, riseMm: 600, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' });
    expect(() => assertSpatialPlacement(source, ramp)).not.toThrow();
    const landing = addRamp(source, { id: 'landing', catalogId: 'builtin:ramp-landing', x: 1800, y: 1800,
      widthMm: 1200, depthMm: 1200, riseMm: 0, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' });
    expect(() => assertSpatialPlacement(source, landing)).not.toThrow();
    const stair = addStair(source, { id: 'stair', kind: 'straight', catalogId: 'stair-straight', x: 1800, y: 1800,
      widthMm: 1200, depthMm: 3000, heightMm: 2700, elevationMm: 0, rotation: 0, stepCount: 15, materialId: 'oak-natural' });
    expect(() => assertSpatialPlacement(source, stair)).not.toThrow();
    const furniture = structuredClone(source);
    furniture.furniture.push({ id: 'blocked', kind: 'box', x: 2000, y: 2000, widthMm: 400, depthMm: 400,
      rotation: 0, dimensionalOrigin: 'physical', heightMm: 800, elevationMm: 0, color: '#8ea69b' });
    expect(() => assertSpatialPlacement(source, furniture)).toThrow('atraviesa');
  });
  it('allows a low independent guard wall on a landing and lifts it to the landing elevation', () => {
    const source = addRamp(fixture(), { id: 'landing', catalogId: 'builtin:ramp-landing', x: 3000, y: 1000,
      widthMm: 1200, depthMm: 1200, riseMm: 0, elevationMm: 900, rotation: 0, materialId: 'concrete-grey' });
    const guarded = addGuardWallPath(source, [{ x: 3000, y: 1000 }, { x: 4200, y: 1000 }]);
    expect(guarded.walls.at(-1)).toMatchObject({ heightMm: 1100, baseElevationMm: 900 });
    expect(() => assertSpatialPlacement(source, guarded)).not.toThrow();
    expect(editorDocumentToScene(guarded).boxes.find((box) => box.sourceEntityId === guarded.walls.at(-1)!.id))
      .toMatchObject({ position: [3.6, 1.45, 1.075], size: [1.05, 1.1, .15] });
  });
  it('allows a 1.50 m legacy protection wall to overlap its landing while it is repaired', () => {
    const source = addRamp(fixture(), { id: 'landing', catalogId: 'builtin:ramp-landing', x: 3000, y: 1000,
      widthMm: 1200, depthMm: 1200, riseMm: 0, elevationMm: 900, rotation: 0, materialId: 'concrete-grey' });
    const repaired = addGuardWallPath(source, [{ x: 3000, y: 1000 }, { x: 4200, y: 1000 }]);
    repaired.walls.at(-1)!.heightMm = 1500;
    expect(() => assertSpatialPlacement(source, repaired)).not.toThrow();
  });
  it('snaps movable objects to the 10 cm X/Y grid before wall alignment', () => {
    const doc = fixture();
    const snapped = snapObject(doc, { ...doc.furniture[0]!, x: 1234, y: 1500 }, .08, true);
    expect(snapped).toMatchObject({ x: 1200, y: 1500 });
    expect(snapObject(doc, { ...doc.furniture[0]!, x: 1234, y: 1566 }, .08, false)).toMatchObject({ x: 1234, y: 1566 });
  });
  it('uses the same visible alignment reference to snap furniture to a landing edge', () => {
    const landing = { id: 'landing', catalogId: 'builtin:ramp-landing', x: 3000, y: 1000, widthMm: 1200, depthMm: 1200,
      riseMm: 0, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' } as const;
    const doc = addRamp(fixture(), landing);
    const item = { ...doc.furniture[0]!, id: 'moving', x: 3200, y: 2100, widthMm: 600, depthMm: 400 };
    const snapped = snapToAlignmentGuides(doc, item, 250);
    expect(snapped.y).toBe(2200);
  });
  it('snaps an object origin to the start or end of a wall', () => {
    const doc = fixture();
    expect(snapObject(doc, { ...doc.furniture[0]!, x: 90, y: 60 }, .08, true)).toMatchObject({ x: 0, y: 0 });
    expect(snapObject(doc, { ...doc.furniture[0]!, x: 4910, y: 60 }, .08, true)).toMatchObject({ x: 5000, y: 0 });
  });
  it('attaches an independent landing flush to a ramp exit and matches its width', () => {
    const source = addRamp(fixture(), { id: 'ramp', catalogId: 'builtin:ramp-straight', x: 1000, y: 2000,
      widthMm: 1200, depthMm: 6000, riseMm: 1200, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' });
    const landing = { id: 'landing', catalogId: 'builtin:ramp-landing', x: 1100, y: 1100,
      widthMm: 900, depthMm: 1000, riseMm: 0, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' } as const;
    expect(snapObject(source, landing, .1, true)).toMatchObject({ x: 1000, y: 1000, widthMm: 1200, elevationMm: 1200, rotation: 0 });
  });
  it('uses the common landing at the upper exit of a stair and joins a stair to a ramp without a gap', () => {
    const stair = { id: 'stair', kind: 'straight' as const, catalogId: 'builtin:stairs-straight', x: 1000, y: 4000,
      widthMm: 1000, depthMm: 3000, heightMm: 1200, elevationMm: 0, rotation: 0, stepCount: 12, materialId: 'oak-natural' };
    const landing = { id: 'landing', catalogId: 'builtin:ramp-landing', x: 0, y: 0, widthMm: 1200, depthMm: 1200,
      riseMm: 0, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' };
    expect(placeLandingAtStairArrival(landing, stair)).toMatchObject({ x: 1000, y: 2800, widthMm: 1000, elevationMm: 1200, rotation: 0 });
    const ramp = { id: 'ramp', catalogId: 'builtin:ramp-straight', x: 1000, y: 4000, widthMm: 1200, depthMm: 3000,
      riseMm: 600, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' };
    expect(placeStairAtRampArrival(stair, ramp)).toMatchObject({ x: 2200, y: 7000, widthMm: 1200, elevationMm: 600, rotation: 180 });
  });
  it('snaps a landing to a stair arrival and a stair to the top of a ramp', () => {
    const source = addStair(fixture(), { id: 'stair', kind: 'straight', catalogId: 'builtin:stairs-straight', x: 1000, y: 4000,
      widthMm: 1000, depthMm: 3000, heightMm: 1200, elevationMm: 0, rotation: 0, stepCount: 12, materialId: 'oak-natural' });
    const landing = { id: 'landing', catalogId: 'builtin:ramp-landing', x: 1050, y: 2850, widthMm: 900, depthMm: 1200,
      riseMm: 0, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' } as const;
    expect(snapObject(source, landing, .1, true)).toMatchObject({ x: 1000, y: 2800, widthMm: 1000, elevationMm: 1200 });
    const rampSource = addRamp(fixture(), { id: 'ramp', catalogId: 'builtin:ramp-straight', x: 1000, y: 4000,
      widthMm: 1200, depthMm: 3000, riseMm: 600, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' });
    const stair = { id: 'stair', kind: 'straight', catalogId: 'builtin:stairs-straight', x: 1150, y: 1050,
      widthMm: 1000, depthMm: 3000, heightMm: 1200, elevationMm: 0, rotation: 0, stepCount: 12, materialId: 'oak-natural' } as const;
    expect(snapObject(rampSource, stair, .1, true)).toMatchObject({ x: 2200, y: 7000, widthMm: 1200, elevationMm: 600, rotation: 180 });
  });
  it('keeps a nearby landing joined to its ramp when editing its typed dimensions', () => {
    const source = addRamp(fixture(), { id: 'ramp', catalogId: 'builtin:ramp-straight', x: 1000, y: 2000,
      widthMm: 1200, depthMm: 6000, riseMm: 1200, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' });
    source.ramps!.push({ id: 'landing', catalogId: 'builtin:ramp-landing', x: 1100, y: 1100,
      widthMm: 900, depthMm: 1000, riseMm: 0, elevationMm: 1200, rotation: 0, materialId: 'concrete-grey', color: '#a6a6a0' });
    expect(updateRamp(source, 'landing', { widthMm: 950 }).ramps!.find((item) => item.id === 'landing'))
      .toMatchObject({ x: 1000, y: 1000, widthMm: 1200, elevationMm: 1200, rotation: 0 });
  });
  it('resizes a landing from its dragged corner while keeping the opposite corner fixed', () => {
    const landing = { id: 'landing', catalogId: 'builtin:ramp-landing', x: 100, y: 200,
      widthMm: 1000, depthMm: 500, riseMm: 0, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' } as const;
    expect(resizeRampFromCorner(landing, 0, { x: -200, y: 100 })).toMatchObject({ x: -200, y: 100, widthMm: 1300, depthMm: 600 });
    const ramp = { ...landing, id: 'ramp', catalogId: 'builtin:ramp-straight', riseMm: 1000 };
    expect(resizeRampFromCorner(ramp, 2, { x: 1400, y: 900 })).toMatchObject({ x: 100, y: 200, widthMm: 1300, depthMm: 700 });
  });
  it('preserves an exact typed ramp width and nudges its position without snapping', () => {
    const source = addRamp(fixture(), { id: 'ramp', catalogId: 'builtin:ramp-straight', x: 1000, y: 2000,
      widthMm: 1174.995, depthMm: 6000, riseMm: 1200, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' });
    const resized = updateRamp(source, 'ramp', { widthMm: 1200 });
    expect(resized.ramps![0]).toMatchObject({ widthMm: 1200 });
    expect(nudgeSpatialEntities(resized, ['ramp'], { x: 10, y: -10 }).ramps![0]).toMatchObject({ x: 997.4975, y: 1990 });
    expect(parseEditorDecimal('1,20')).toBe(1.2);
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
