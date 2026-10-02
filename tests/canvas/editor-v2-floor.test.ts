import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addOpening, addWallPath, shapePoints } from '@/canvas/editor-v2/editing-operations';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { polygonArea } from '@/lib/editor-document/geometry';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { deriveRooms } from '@/lib/editor-document/rooms';

const rectangle = () => addWallPath(emptyEditorDocument(), [
  { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 },
], true);
describe('interior finished floor', () => {
  it('stops at inner wall faces with no slab underneath and does not mutate the document', () => {
    const doc = rectangle(), snapshot = structuredClone(doc);
    const floor = editorDocumentToScene(doc).polygons.find((p) => p.role === 'floor')!;
    expect(floor.height).toBe(0); expect(floor.elevation).toBe(0);
    expect(Math.min(...floor.points.map((p) => p.x))).toBe(.075);
    expect(Math.max(...floor.points.map((p) => p.x))).toBe(5.925);
    expect(Math.min(...floor.points.map((p) => p.y))).toBe(.075);
    expect(Math.max(...floor.points.map((p) => p.y))).toBe(3.925);
    expect(doc).toEqual(snapshot);
  });
  it('respects different thicknesses instead of applying one global inset', () => {
    const doc = rectangle(); doc.walls[0]!.thicknessMm = 300;
    const floor = editorDocumentToScene(doc).polygons.find((p) => p.role === 'floor')!;
    expect(Math.min(...floor.points.map((p) => p.y))).toBe(.15);
    expect(Math.min(...floor.points.map((p) => p.x))).toBe(.075);
  });
  it('projects an elevated room as a solid podium by default, or as an explicit structural slab', () => {
    const source = rectangle(), room = deriveRooms(source)[0]!;
    const solid = setFloorFinish(source, room.id, { elevationMm: 1800 });
    const podium = editorDocumentToScene(solid).polygons.find((p) => p.sourceEntityId === room.id)!;
    expect(podium).toMatchObject({ elevation: 0, height: 1.8 });
    const slab = setFloorFinish(solid, room.id, { slabThicknessMm: 250, undersideColor: '#123456' });
    const structural = editorDocumentToScene(slab).polygons.find((p) => p.sourceEntityId === room.id)!;
    expect(structural).toMatchObject({ elevation: 1.55, height: .25, sideColor: '#123456' });
    const faced = setFloorFinish(solid, room.id, { undersideTexture: 'polyhaven:brushed_concrete' });
    expect(editorDocumentToScene(faced).polygons.find((p) => p.sourceEntityId === room.id))
      .toMatchObject({ sideColor: '#ffffff', floorFinish: { undersideTexture: 'polyhaven:brushed_concrete' } });
  });
  it('keeps door thresholds at floor level but clips solid window sills', () => {
    for (const kind of ['puerta', 'ventana'] as const) {
      let doc = rectangle(); doc = addOpening(doc, doc.walls[0]!.id, { x: 3000, y: 0 }, kind);
      const floor = editorDocumentToScene(doc).polygons.find((p) => p.role === 'floor')!;
      expect(Math.min(...floor.points.map((p) => p.y))).toBe(kind === 'puerta' ? 0 : .075);
    }
  });
  it('retains concave L shape at arbitrary rotation without boolean slivers', () => {
    for (const angle of [0, 37, 90, 180]) {
      const radians = angle * Math.PI / 180;
      const points = shapePoints('L', { x: 0, y: 0 }).map(({ x, y }) => ({
        x: x * Math.cos(radians) - y * Math.sin(radians) + 12345,
        y: x * Math.sin(radians) + y * Math.cos(radians) - 4321,
      }));
      const scene = editorDocumentToScene(addWallPath(emptyEditorDocument(), points, true));
      expect(scene.warnings).toEqual([]);
      const floors = scene.polygons.filter((p) => p.role === 'floor');
      expect(floors).toHaveLength(1);
      expect(Math.abs(polygonArea(floors[0]!.points))).toBeCloseTo(25.2225, 5);
    }
  });
  it('represents holes under interior wall islands without filling them', () => {
    const doc = addWallPath(rectangle(), [{ x: 2000, y: 2000 }, { x: 3000, y: 2000 }]);
    const floor = editorDocumentToScene(doc).polygons.find((p) => p.role === 'floor')!;
    expect(floor.holes).toHaveLength(1);
    expect(Math.abs(polygonArea(floor.holes![0]!))).toBeCloseTo(.15);
  });
  it('does not invent a surface when wall thickness consumes the entire room', () => {
    const doc = addWallPath(emptyEditorDocument(), [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 2000 }, { x: 0, y: 2000 },
    ], true);
    const scene = editorDocumentToScene(doc);
    expect(scene.warnings).toEqual([]);
    expect(scene.polygons.filter((p) => p.role === 'floor')).toEqual([]);
  });
});
