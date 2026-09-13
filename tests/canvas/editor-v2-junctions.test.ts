import { describe, expect, it } from 'vitest';
import { addWallPath, interiorPoint, shapePoints } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { wallJunctions } from '@/canvas/editor-v2/wall-junctions';

describe('wall joins and interior positions', () => {
  it('closes the exterior square corner of perpendicular walls', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 2000, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 2000 }]);
    const points = wallJunctions(doc)[0]!.points;
    expect(points).toContainEqual({ x: -75, y: -75 });
    expect(points).toContainEqual({ x: 75, y: 75 });
  });
  it('honors different wall thicknesses without rounding the join', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 2000, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 2000 }]);
    doc.walls[1]!.thicknessMm = 300;
    expect(wallJunctions(doc)[0]!.points).toContainEqual({ x: -150, y: -75 });
  });
  it('limits acute miters rather than creating long spikes', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 3000, y: 0 }, { x: 0, y: 0 }, { x: 3000, y: 100 }]);
    expect(wallJunctions(doc)[0]!.points.every((p) => Math.hypot(p.x, p.y) <= 300)).toBe(true);
  });
  it('places an L room label away from the missing quadrant', () => {
    const p = interiorPoint(shapePoints('L', { x: 0, y: 0 }));
    expect(p.x < 3000 || p.y < 3000).toBe(true);
    expect(p.x).toBeGreaterThan(0); expect(p.y).toBeGreaterThan(0);
  });
});
