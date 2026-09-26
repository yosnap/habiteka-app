import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { wallFaces } from '@/lib/editor-document/wall-faces';
import { paintElement } from '@/lib/editor-document/spatial-commands';
import { wallMeshes, junctionMeshes } from '@/canvas/editor-v2/scene/wall-meshes';
import { WALL_SECTION_COLOR } from '@/lib/editor-document/wall-appearance';

describe('interior and exterior wall finishes', () => {
  const points = [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }];
  it('identifies interior independently of drawing direction', () => {
    for (const reverse of [false, true]) {
      const doc = addWallPath(emptyEditorDocument(), reverse ? [...points].reverse() : points, true);
      for (const wall of doc.walls) expect(wallFaces(doc, wall)).toEqual([
        { side: reverse ? 'right' : 'left', label: 'Interior' },
        { side: reverse ? 'left' : 'right', label: 'Exterior' },
      ]);
    }
  });
  it('does not invent interior for an open contour and names both rooms on a partition', () => {
    let doc = addWallPath(emptyEditorDocument(), points);
    expect(wallFaces(doc, doc.walls[0]!)).toEqual([]);
    doc = addWallPath(emptyEditorDocument(), points, true);
    doc = addWallPath(doc, [points[1]!, { x: 9000, y: 0 }, { x: 9000, y: 4000 }, points[2]!]);
    expect(wallFaces(doc, doc.walls[1]!).map((f) => f.label).every((label) => label.startsWith('Interior · habitación'))).toBe(true);
  });
  it('painting either face leaves opposite face, top, end caps and junctions unchanged', () => {
    const base = addWallPath(emptyEditorDocument(), points, true), id = base.walls[0]!.id;
    const left = paintElement(base, id, 'left', '#ff0000');
    const both = paintElement(left, id, 'right', '#0000ff');
    const before = wallMeshes(left, left.walls[0]!)[0]!;
    const after = wallMeshes(both, both.walls[0]!)[0]!;
    expect(before.sideColors?.[0]).toBe('#ff0000');
    expect(after.sideColors).toEqual(['#ff0000', '#0000ff']);
    expect(after.color).toBe(before.color);
    expect(after.color).not.toBe('#ff0000');
    expect(after.topColor).toBe(WALL_SECTION_COLOR);
    expect(junctionMeshes(both).every((mesh) => mesh.topColor === WALL_SECTION_COLOR)).toBe(true);
    const leftEdges = junctionMeshes(left).flatMap((j) => j.edgeFinishes ?? []);
    const bothEdges = junctionMeshes(both).flatMap((j) => j.edgeFinishes ?? []);
    expect(bothEdges.filter((edge) => edge.color === '#ff0000')).toEqual(leftEdges.filter((edge) => edge.color === '#ff0000'));
    expect(bothEdges.some((edge) => edge.color === '#0000ff')).toBe(true);
    expect(bothEdges.filter((edge) => edge.sourceEntityId !== id)).toEqual(leftEdges.filter((edge) => edge.sourceEntityId !== id));
  });
  it('uses the original color map for a photographic wall finish', () => {
    const doc = addWallPath(emptyEditorDocument(), points, true);
    const wall = { ...doc.walls[0]!, materials: { left: 'polyhaven:painted_plaster_wall', right: 'plaster-white' } };
    const mesh = wallMeshes({ ...doc, walls: [wall, ...doc.walls.slice(1)] }, wall)[0]!;
    expect(mesh.sideMaterials).toEqual(['polyhaven:painted_plaster_wall', 'plaster-white']);
    expect(mesh.sideColors).toEqual(['#ffffff', '#e0dcd4']);
  });
  it('continues different exterior paints to the two edges of the same miter', () => {
    let doc = addWallPath(emptyEditorDocument(), points, true);
    doc = paintElement(doc, doc.walls[0]!.id, 'right', '#0000ff');
    doc = paintElement(doc, doc.walls[3]!.id, 'right', '#00ff00');
    const join = junctionMeshes(doc).find((j) => j.id.startsWith(`junction:${doc.vertices[0]!.id}:`))!;
    const edges = join.points.map((a, index) => ({ a, b: join.points[(index + 1) % join.points.length]!, finish: join.edgeFinishes![index]! }));
    const horizontal = edges.filter(({ a, b }) => Math.abs(a.y + .075) < 1e-7 && Math.abs(b.y + .075) < 1e-7);
    const vertical = edges.filter(({ a, b }) => Math.abs(a.x + .075) < 1e-7 && Math.abs(b.x + .075) < 1e-7);
    expect(horizontal.length).toBeGreaterThan(0);
    expect(vertical.length).toBeGreaterThan(0);
    expect(horizontal.every((edge) => edge.finish.color === '#0000ff')).toBe(true);
    expect(vertical.every((edge) => edge.finish.color === '#00ff00')).toBe(true);
    expect(join.topColor).toBe(WALL_SECTION_COLOR);
  });
});
