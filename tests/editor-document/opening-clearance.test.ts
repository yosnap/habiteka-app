import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { wallOpeningClearance } from '@/lib/editor-document/opening-clearance';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { parseEditorDocument } from '@/lib/editor-document/validation';

describe('opening clearance at wall junctions', () => {
  it('reserves neighbor half-thickness at a perpendicular join and zero at free endpoints', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }]);
    doc.walls[1]!.thicknessMm = 240;
    expect(wallOpeningClearance(doc, doc.walls[0]!)).toEqual({ startMm: 0, endMm: 120 });
  });
  it('includes the full host thickness envelope for diagonal adjacent walls', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 2000, y: 3000 }]);
    const clearance = wallOpeningClearance(doc, doc.walls[0]!);
    expect(clearance.endMm).toBeCloseTo((75 + 75 * Math.SQRT1_2) / Math.SQRT1_2);
  });
  it('does not invent clearance for collinear continuation', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 10000, y: 0 }]);
    expect(wallOpeningClearance(doc, doc.walls[0]!)).toEqual({ startMm: 0, endMm: 0 });
  });
  it('keeps historical corner openings readable and migratable without silently moving them', () => {
    let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }]);
    doc = addOpening(doc, doc.walls[0]!.id, { x: 4550, y: 0 }, 'puerta');
    expect(parseEditorDocument(doc).openings[0]!.position).toBe(.91);
    expect(upgradeConstructionDocument(doc).openings[0]!.position).toBe(.91);
  });
});
