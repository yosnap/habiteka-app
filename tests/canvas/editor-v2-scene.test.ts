import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type Stair } from '@/lib/editor-document/schema';
import { addFurniture, addOpening, addWallPath, shapePoints } from '@/canvas/editor-v2/editing-operations';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { OUTDOOR_CATALOG } from '@/lib/editor-document/outdoor-catalog';
import { wallMeshes, junctionMeshes } from '@/canvas/editor-v2/scene/wall-meshes';
import { openingMeshes } from '@/canvas/editor-v2/scene/opening-meshes';
import { setWallCurve } from '@/lib/editor-document/curve-commands';
import { stairMeshes } from '@/canvas/editor-v2/scene/stair-meshes';
import { Shape, ShapeGeometry } from 'three';

describe('canonical scene projection', () => {
  it.each(['piscina', 'estanque'])('proyecta el agua de %s sin cambiar su volumen', (kind) => {
    const entry = OUTDOOR_CATALOG.find((item) => item.kind === kind)!;
    const doc = addFurniture(emptyEditorDocument(), entry, { x: 0, y: 0 });
    const water = editorDocumentToScene(doc).boxes.find((box) => box.appearance === 'water');
    expect(water?.sourceEntityId).toBe(doc.furniture[0]!.id);
    expect(water?.size).toEqual([
      entry.widthMm * .88 / 1000, entry.heightMm * .02 / 1000, entry.depthMm * .88 / 1000,
    ]);
  });
  it('converts mm to meters with stable origin without mutating legacy v2', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 1000, y: 2000 }, { x: 6000, y: 2000 }]);
    const snapshot = structuredClone(doc), scene = editorDocumentToScene(doc);
    expect(scene.boxes[0]!.position).toEqual([3.5, 1.35, 2]);
    expect(scene.boxes[0]!.size).toEqual([5, 2.7, .15]);
    expect(doc).toEqual(snapshot);
    expect(scene.polygons.filter((p) => p.role === 'floor')).toHaveLength(0);
  });
  it('door leaves a real gap and lintel; moving it restores old host completely', () => {
    let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }]);
    doc = addOpening(doc, doc.walls[0]!.id, { x: 3000, y: 0 }, 'puerta');
    const wall = doc.walls[0]!, meshes = wallMeshes(doc, wall);
    expect(meshes).toHaveLength(3);
    expect(meshes.some((m) => Math.abs(m.position[0] - 3) < .45 && m.position[1] - m.size[1] / 2 < 2.1)).toBe(false);
    const moved = structuredClone(doc); moved.openings[0]!.wallId = moved.walls[1]!.id;
    expect(wallMeshes(moved, wall)).toHaveLength(1);
    expect(wallMeshes(moved, moved.walls[1]!)).toHaveLength(3);
  });
  it('window retains sill and lintel but no wall behind its glass', () => {
    let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }]);
    doc = addOpening(doc, doc.walls[0]!.id, { x: 3000, y: 0 }, 'ventana');
    const meshes = wallMeshes(doc, doc.walls[0]!);
    expect(meshes).toHaveLength(4);
    const central = meshes.filter((m) => m.position[0] === 3);
    expect(central.map((m) => m.size[1])).toEqual([.9, .6]);
    const opening = openingMeshes(doc, doc.openings[0]!);
    expect(opening.filter((m) => m.role === 'glass')).toHaveLength(1);
    const seals = opening.filter((m) => m.role === 'seal');
    expect(seals).toHaveLength(8);
    expect(new Set(seals.map((m) => Math.sign(m.position[2])))).toEqual(new Set([-1, 1]));
    expect(seals.every((m) => m.sourceEntityId === doc.openings[0]!.id)).toBe(true);
    const glass = opening.find((m) => m.role === 'glass')!;
    expect(glass.size[0]).toBeCloseTo(1.11);
    expect(glass.position[2]).toBe(0);
  });
  it('curved window follows the arc with glazing and seals on both faces', () => {
    const straight = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }]);
    let doc = setWallCurve(straight, straight.walls[0]!.id, 500);
    doc = addOpening(doc, doc.walls[0]!.id, { x: 3000, y: 500 }, 'ventana');
    const opening = openingMeshes(doc, doc.openings[0]!);
    const glass = opening.filter((m) => m.role === 'glass');
    const seals = opening.filter((m) => m.role === 'seal');
    expect(glass.length).toBeGreaterThan(1);
    expect(seals.length).toBeGreaterThan(8);
    expect(seals.some((m) => m.position[2] > glass[0]!.position[2])).toBe(true);
    expect(seals.some((m) => m.position[2] < glass[0]!.position[2])).toBe(true);
  });
  it('door swing changes side and hinge without changing source wall geometry', () => {
    let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }]);
    doc = addOpening(doc, doc.walls[0]!.id, { x: 3000, y: 0 }, 'puerta');
    const o = doc.openings[0]!;
    const left = openingMeshes(doc, { ...o, hinge: 'left', swing: 'left', openAngleDeg: 90 }).find((m) => m.role === 'leaf')!;
    const right = openingMeshes(doc, { ...o, hinge: 'right', swing: 'right', openAngleDeg: 90 }).find((m) => m.role === 'leaf')!;
    expect(left.position[2]).toBeGreaterThan(0); expect(right.position[2]).toBeLessThan(0);
    expect(left.position[0]).toBeLessThan(right.position[0]);
  });
  it('triangulates a concave floor to its actual area, not the bounding box', () => {
    const doc = addWallPath(emptyEditorDocument(), shapePoints('L', { x: 0, y: 0 }), true);
    const floor = editorDocumentToScene(doc).polygons.find((p) => p.role === 'floor')!;
    const shape = new Shape(); floor.points.forEach((p, i) => i ? shape.lineTo(p.x, -p.y) : shape.moveTo(p.x, -p.y)); shape.closePath();
    const geometry = new ShapeGeometry(shape).toNonIndexed(), positions = geometry.getAttribute('position');
    let area = 0;
    for (let i = 0; i < positions.count; i += 3) area += Math.abs(
      (positions.getX(i + 1) - positions.getX(i)) * (positions.getY(i + 2) - positions.getY(i)) -
      (positions.getY(i + 1) - positions.getY(i)) * (positions.getX(i + 2) - positions.getX(i))) / 2;
    // Finished surface reaches inner faces, not the 27 m² wall-axis polygon.
    expect(area).toBeCloseTo(25.2225); geometry.dispose();
  });
  it('joins unequal-height walls only up to their shared height', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }]);
    doc.walls[0]!.heightMm = 2000; doc.walls[1]!.heightMm = 3000;
    expect(junctionMeshes(doc).every((m) => m.elevation + m.height <= 2)).toBe(true);
  });
  it('does not fill a corner opening with the shared junction mesh', () => {
    let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }]);
    doc = addOpening(doc, doc.walls[0]!.id, { x: 3550, y: 0 }, 'puerta');
    expect(junctionMeshes(doc).every((m) => m.elevation >= 2.1)).toBe(true);
  });
  it('keeps diagonal lengths and outward visibility normals for concave rooms', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 3000, y: 4000 }, { x: 0, y: 4000 }], true);
    const scene = editorDocumentToScene(doc), diagonal = scene.boxes.find((b) => b.sourceEntityId === doc.walls[0]!.id)!;
    expect(diagonal.size[0]).toBe(5); expect(diagonal.rotation).toBeCloseTo(-Math.atan2(4, 3));
    expect(scene.exteriorWalls).toHaveLength(3);
    const outer = scene.exteriorWalls.find((w) => w.sourceEntityId === doc.walls[0]!.id)!;
    expect(outer.normalX).toBeCloseTo(.8); expect(outer.normalZ).toBeCloseTo(-.6);
  });
  it.each(['straight', 'L', 'U'] as const)('projects %s stair final height and footprint including rotation/elevation', (kind) => {
    const stair: Stair = { id: 's', kind, catalogId: 's', x: 1000, y: 2000, widthMm: 2400, depthMm: 4000,
      heightMm: 2700, elevationMm: 300, rotation: 90, stepCount: 15, materialId: 'oak-natural' };
    const meshes = stairMeshes(stair), steps = meshes.filter((m) => m.role === 'step' || m.role === 'landing');
    expect(Math.max(...steps.map((m) => m.position[1] + m.size[1] / 2))).toBeCloseTo(3);
    expect(steps.every((m) => m.position[0] >= -3 && m.position[0] <= 1 && m.position[2] >= 2 && m.position[2] <= 4.4)).toBe(true);
    expect(meshes.some((m) => m.role === 'rail')).toBe(true);
  });
});
