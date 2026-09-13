import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type Stair } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { addStair, setOpeningConstruction, setWallConstruction, updateStair, removeStair } from '@/lib/editor-document/construction-commands';
import { stairLayout } from '@/lib/editor-document/stair-layout';

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
});
