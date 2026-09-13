import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { wallPath, wallStrip } from '@/lib/editor-document/wall-path';
import { defaultWallCurve, setWallCurve } from '@/lib/editor-document/curve-commands';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { applyCommand } from '@/lib/editor-document/commands';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { resolveOpeningPlacement } from '@/canvas/editor-v2/opening-placement';
import { createEditorStore } from '@/canvas/editor-v2/store';

const rectangle = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }], true);
describe('canonical circular wall', () => {
  it('defaults outward for every room wall regardless of its drawing direction', () => {
    const source = rectangle();
    for (const wall of source.walls) for (const reversed of [false, true]) {
      const doc = reversed ? applyCommand(source, { type: 'invert-wall', wallId: wall.id }) : source;
      const curved = setWallCurve(doc, wall.id, defaultWallCurve(doc, wall.id));
      expect(deriveRooms(curved)[0]!.areaMm2).toBeGreaterThan(25e6);
    }
  });
  it('has exact endpoints, signed sagitta, arc length and normal thickness', () => {
    for (const height of [-1000, 1000]) {
      const source = rectangle(), doc = setWallCurve(source, source.walls[0]!.id, height), wall = doc.walls[0]!, p = wallPath(doc, wall);
      expect(p.at(0).x).toBe(0); expect(p.at(1).x).toBe(5000);
      expect(p.at(.5).x).toBeCloseTo(2500); expect(p.at(.5).y).toBeCloseTo(height);
      expect(p.length).toBeGreaterThan(5000); expect(p.project(p.at(.3))).toBeCloseTo(.3);
      const strip = wallStrip(doc, wall), opposite = strip.at(-1)!;
      expect(Math.hypot(strip[0]!.x - opposite.x, strip[0]!.y - opposite.y)).toBeCloseTo(150);
      expect(doc.walls).toHaveLength(4); expect(source.schemaVersion).toBe(2);
    }
  });
  it('updates room outline and floor in both curvature directions without changing wall IDs', () => {
    const source = rectangle();
    for (const height of [-1000, 1000]) {
      const doc = setWallCurve(source, source.walls[0]!.id, height), room = deriveRooms(doc)[0]!;
      expect(room.id).toBe(deriveRooms(source)[0]!.id);
      expect(room.boundary.length).toBeGreaterThan(4);
      expect(room.areaMm2 < 25e6).toBe(height > 0);
      const scene = editorDocumentToScene(doc);
      expect(scene.warnings).toEqual([]); expect(scene.polygons.some((p) => p.role === 'wall')).toBe(true);
      expect(scene.polygons.some((p) => p.role === 'floor')).toBe(true);
    }
  });
  it('preserves the arc when reversed or split, including normalized openings', () => {
    const source = rectangle(), doc = setWallCurve(source, source.walls[0]!.id, -1000), id = doc.walls[0]!.id;
    const reversed = applyCommand(doc, { type: 'invert-wall', wallId: id });
    expect(wallPath(reversed, reversed.walls[0]!).at(.3).y).toBeCloseTo(wallPath(doc, doc.walls[0]!).at(.7).y);
    const split = applyCommand(doc, { type: 'split-wall', wallId: id, position: .4, vertexId: 'new-v', newWallId: 'new-w' });
    const total = [split.walls[0]!, split.walls.at(-1)!].reduce((sum, w) => sum + wallPath(split, w).length, 0);
    expect(total).toBeCloseTo(wallPath(doc, doc.walls[0]!).length);
    expect(parseEditorDocument(split)).toEqual(split);
  });
  it('snaps openings to arc rather than its chord and creates 3D voids', () => {
    const source = rectangle(); let doc = setWallCurve(source, source.walls[0]!.id, -1000);
    doc = addOpening(doc, doc.walls[0]!.id, { x: 2500, y: -1000 }, 'puerta');
    const placed = resolveOpeningPlacement(doc, { x: 2500, y: -1000 }, .08, doc.openings[0]!)!;
    expect(placed.valid).toBe(true); expect(placed.center.y).toBeCloseTo(-1000);
    expect(editorDocumentToScene(doc).warnings).toEqual([]);
  });
  it('rejects invalid curves and can undo back to an old document', () => {
    const doc = rectangle(), id = doc.walls[0]!.id, store = createEditorStore(doc);
    expect(() => setWallCurve(doc, id, 10000)).toThrow();
    store.getState().apply(setWallCurve(doc, id, 1000)); store.getState().undo();
    expect(store.getState().document).toEqual(doc);
    expect(setWallCurve(setWallCurve(doc, id, 1000), id, 0).walls[0]!.curveHeightMm).toBeUndefined();
  });
});
