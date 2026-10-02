import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type Column, type Ramp, type Stair } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { addColumn, addRamp, addStair, setOpeningConstruction, setWallConstruction, setWallVisibility, updateColumn, updateRamp, updateStair, removeRamp, removeStair } from '@/lib/editor-document/construction-commands';
import { stairLayout } from '@/lib/editor-document/stair-layout';
import { rampLayout } from '@/lib/editor-document/ramp-layout';
import { rampParts } from '@/lib/editor-document/ramp-route';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';

function fixture() {
  const doc = emptyEditorDocument();
  doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 5000, y: 0 }];
  doc.walls = [{ id: 'w', startVertexId: 'a', endVertexId: 'b', thicknessMm: 150, dimensionalOrigin: 'physical' }];
  doc.openings = [{ id: 'o', wallId: 'w', kind: 'ventana', position: 0.5, widthMm: 1200, dimensionalOrigin: 'physical' }];
  return doc;
}
const stair: Stair = { id: 's', kind: 'U', catalogId: 'stair-U', x: 200, y: 300,
  widthMm: 2200, depthMm: 3000, heightMm: 2700, elevationMm: 0, rotation: 37,
  stepCount: 16, materialId: 'wood-oak' };
const ramp: Ramp = { id: 'r', catalogId: 'builtin:ramp-straight', x: 200, y: 300,
  widthMm: 1200, depthMm: 15000, riseMm: 1200, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' };
const column: Column = { id: 'column', catalogId: 'builtin:column-rectangular', x: 1000, y: 2000,
  widthMm: 400, depthMm: 400, heightMm: 2700, elevationMm: 0, rotation: 0, materialId: 'concrete-grey', color: '#a6a6a0' };

describe('construction v3 contract', () => {
  it('reads immutable v2 exactly and upgrades only explicitly with deterministic defaults', () => {
    const old = fixture();
    const json = JSON.stringify(old);
    expect(JSON.stringify(parseEditorDocument(old))).toBe(json);
    const modern = upgradeConstructionDocument(old);
    expect(modern.schemaVersion).toBe(3);
    expect(modern.walls[0]!.heightMm).toBe(2700);
    expect(modern.openings[0]).toMatchObject({ elevationMm: 900, heightMm: 1200 });
    expect(openingConstruction(old.openings[0]!)).toEqual(openingConstruction(modern.openings[0]!));
    expect(JSON.stringify(old)).toBe(json);
    expect(upgradeConstructionDocument(modern)).toEqual(modern);
  });
  it('rejects unknown fields rather than silently dropping future construction data', () => {
    const doc = upgradeConstructionDocument(fixture());
    expect(() => parseEditorDocument({ ...doc, future: true })).toThrow();
    expect(() => parseEditorDocument({ ...doc, walls: [{ ...doc.walls[0], curve: 3 }] })).toThrow();
    expect(() => parseEditorDocument({ ...doc, walls: [{ ...doc.walls[0], materials: { left: 'a', right: 'b', back: 'c' } }] })).toThrow();
    expect(() => parseEditorDocument({ ...fixture(), stairs: [] })).toThrow();
  });
  it('requires complete v3 construction fields and prevents invalid vertical openings', () => {
    expect(() => parseEditorDocument({ ...fixture(), schemaVersion: 3, stairs: [] })).toThrow();
    expect(() => setWallConstruction(fixture(), 'w', { heightMm: -1 })).toThrow();
    expect(() => setOpeningConstruction(fixture(), 'o', { elevationMm: -1 })).toThrow();
    expect(() => setOpeningConstruction(fixture(), 'o', { heightMm: 2000 })).toThrow();
    expect(() => setOpeningConstruction(fixture(), 'o', { openAngleDeg: 181 })).toThrow();
    expect(() => setWallConstruction(fixture(), 'w', { heightMm: 1500 })).toThrow();
  });
  it('preserves v3 properties through JSON and immutable stair commands', () => {
    const source = fixture();
    const added = addStair(source, stair);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(added)))).toEqual(added);
    const moved = updateStair(added, 's', { x: 800, rotation: 90 });
    expect(added.stairs![0]!.x).toBe(200);
    expect(moved.stairs![0]).toMatchObject({ x: 800, rotation: 90 });
    expect(removeStair(moved, 's').stairs).toEqual([]);
    expect(source.schemaVersion).toBe(2);
    expect(() => addStair(added, stair)).toThrow('ID duplicado');
  });
  it('keeps a raised wall base and measures its height from that base', () => {
    const raised = setWallConstruction(fixture(), 'w', { heightMm: 1100, baseElevationMm: 1000 });
    expect(raised.walls[0]).toMatchObject({ heightMm: 1100, baseElevationMm: 1000 });
    const boxes = editorDocumentToScene(raised).boxes.filter((box) => box.sourceEntityId === 'w');
    expect(boxes).not.toHaveLength(0);
    expect(boxes.every((box) => box.position[1] === 1.55 && box.size[1] === 1.1)).toBe(true);
  });
  it.each(['straight', 'L', 'U'] as const)('generates coherent %s steps within footprint and exact total height', (kind) => {
    const model = { ...stair, kind };
    const layout = stairLayout(model);
    expect(layout.steps.length + layout.landings.length).toBe(model.stepCount);
    expect(Math.max(...layout.steps.map((step) => step.heightMm))).toBe(model.heightMm);
    for (const step of [...layout.steps, ...layout.landings]) {
      expect(step.x).toBeGreaterThanOrEqual(0);
      expect(step.y).toBeGreaterThanOrEqual(0);
      expect(step.x + step.widthMm).toBeLessThanOrEqual(model.widthMm + 1e-8);
      expect(step.y + step.depthMm).toBeLessThanOrEqual(model.depthMm + 1e-8);
    }
  });
  it('rejects invalid stair parameters', () => {
    expect(() => addStair(fixture(), { ...stair, stepCount: 2 })).toThrow();
    expect(() => addStair(fixture(), { ...stair, depthMm: 500 })).toThrow();
    expect(() => addStair(fixture(), { ...stair, heightMm: NaN })).toThrow();
  });
  it('stores a continuous ramp with its real rise and computed slope', () => {
    const added = addRamp(fixture(), ramp);
    expect(added.schemaVersion).toBe(6);
    expect(added.ramps).toEqual([{ ...ramp, color: '#a6a6a0' }]);
    expect(rampLayout(added.ramps![0]!).slopePercent).toBe(8);
    expect(editorDocumentToScene(added).ramps[0]).toMatchObject({ sourceEntityId: 'r', width: 1.2, depth: 15, rise: 1.2 });
    const updated = updateRamp(added, 'r', { depthMm: 12000, riseMm: 1200 });
    expect(rampLayout(updated.ramps![0]!).slopePercent).toBe(10);
    const routeCases = [
      { turn: 'left' as const, rotation: -90, x: -6000, y: 0 },
      { turn: 'right' as const, rotation: 90, x: 7200, y: -1200 },
      { turn: 'reverse' as const, rotation: 180, x: 1200, y: 0 },
    ];
    for (const expected of routeCases) {
      const routed = updateRamp(updated, 'r', { route: { landingMm: 1500, turn: expected.turn, secondDepthMm: 6000, secondRiseMm: 400 } });
      expect(editorDocumentToScene(routed).ramps).toHaveLength(3);
      const [first, landing, second] = rampParts(routed.ramps![0]!);
      const routedScene = editorDocumentToScene(routed);
      expect(landing).toMatchObject({ x: 0, y: -routed.ramps![0]!.widthMm });
      expect(landing!.depthMm).toBe(routed.ramps![0]!.widthMm);
      expect(landing!.elevationMm).toBe(routed.ramps![0]!.elevationMm + routed.ramps![0]!.riseMm);
      expect(second!.elevationMm).toBe(landing!.elevationMm);
      expect(second!.riseMm).toBe(400);
      expect(routedScene.ramps[1]).toMatchObject({ position: expect.arrayContaining([expect.any(Number), 0]), baseHeight: 1.2 });
      expect(routedScene.ramps[2]).toMatchObject({ position: expect.arrayContaining([expect.any(Number), 0]), baseHeight: 1.2 });
      expect(second).toMatchObject({ rotation: expected.rotation, x: expected.x, y: expected.y });
    }
    expect(removeRamp(updated, 'r').ramps).toEqual([]);
    expect(() => addRamp(fixture(), { ...ramp, riseMm: 0 })).toThrow('Una rampa debe tener desnivel');
  });
  it('stores an independent landing as a solid level platform', () => {
    const landing: Ramp = { ...ramp, id: 'landing', catalogId: 'builtin:ramp-landing', widthMm: 1200, depthMm: 1500,
      riseMm: 0, elevationMm: 1200 };
    const added = addRamp(fixture(), landing);
    expect(added.ramps![0]).toMatchObject(landing);
    expect(editorDocumentToScene(added).ramps[0]).toMatchObject({ sourceEntityId: 'landing', position: expect.arrayContaining([0, 0]), baseHeight: 1.2, rise: 0 });
  });
  it('projects configurable ramp rails on every inclined route segment', () => {
    const added = addRamp(fixture(), { ...ramp, railingLeft: false, route: { landingMm: 1200, turn: 'right', secondDepthMm: 3000, secondRiseMm: 600 } });
    const scene = editorDocumentToScene(added).ramps;
    expect(scene).toHaveLength(3);
    expect(scene.filter((part) => part.rise > 0).every((part) => part.railingLeft === false && part.railingRight === true)).toBe(true);
    const hidden = updateRamp(added, ramp.id, { railingLeft: false, railingRight: false });
    expect(editorDocumentToScene(hidden).ramps.filter((part) => part.rise > 0).every((part) => !part.railingLeft && !part.railingRight)).toBe(true);
  });
  it('stores a structural column as an editable 2D/3D solid', () => {
    const added = addColumn(fixture(), column), scene = editorDocumentToScene(added);
    expect(added.columns).toEqual([column]);
    expect(scene.boxes.find((box) => box.sourceEntityId === column.id)).toMatchObject({ role: 'column', position: [1.2, 1.35, 2.2], size: [.4, 2.7, .4], materialId: 'concrete-grey' });
    expect(updateColumn(added, column.id, { widthMm: 500 }).columns![0]).toMatchObject({ widthMm: 500, x: 950 });
    const painted = updateColumn(added, column.id, { materialId: 'polyhaven:white_plaster_02' });
    expect(painted.columns![0]).toMatchObject({ materialId: 'polyhaven:white_plaster_02', color: '#ffffff' });
    expect(editorDocumentToScene(painted).boxes.find((box) => box.sourceEntityId === column.id))
      .toMatchObject({ materialId: 'polyhaven:white_plaster_02', color: '#ffffff' });
  });
  it('allows independently hiding each side rail or all rails from a stair', () => {
    const added = addStair(fixture(), { ...stair, kind: 'straight', rotation: 0, railingLeft: false });
    const leftHidden = editorDocumentToScene(added).boxes.filter((box) => box.sourceEntityId === stair.id && box.role === 'rail');
    expect(leftHidden.length).toBeGreaterThan(0);
    const none = updateStair(added, stair.id, { railingLeft: false, railingRight: false });
    expect(editorDocumentToScene(none).boxes.filter((box) => box.sourceEntityId === stair.id && box.role === 'rail')).toHaveLength(0);
  });
  it('keeps a hidden wall as a room boundary while removing its physical geometry', () => {
    const source = emptyEditorDocument();
    source.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 4000, y: 0 }, { id: 'c', x: 4000, y: 3000 }, { id: 'd', x: 0, y: 3000 }];
    source.walls = [{ id: 'w', startVertexId: 'a', endVertexId: 'b', thicknessMm: 150, dimensionalOrigin: 'physical' },
      { id: 'w2', startVertexId: 'b', endVertexId: 'c', thicknessMm: 150, dimensionalOrigin: 'physical' },
      { id: 'w3', startVertexId: 'c', endVertexId: 'd', thicknessMm: 150, dimensionalOrigin: 'physical' },
      { id: 'w4', startVertexId: 'd', endVertexId: 'a', thicknessMm: 150, dimensionalOrigin: 'physical' }];
    const hidden = setWallVisibility(source, 'w', true), scene = editorDocumentToScene(hidden);
    expect(hidden.walls[0]).toMatchObject({ id: 'w', hidden: true });
    expect(scene.boxes.some((box) => box.sourceEntityId === 'w')).toBe(false);
    expect(scene.polygons.some((polygon) => polygon.role === 'floor')).toBe(true);
    expect(setWallVisibility(hidden, 'w', false).walls[0]?.hidden).toBeUndefined();
  });
});
