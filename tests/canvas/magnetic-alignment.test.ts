import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { alignPoint, alignPoints, footprintAnchors, magneticReferences } from '@/canvas/editor-v2/magnetic-alignment';
import { addWallPath, nudgeSpatialEntities } from '@/canvas/editor-v2/editing-operations';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { resolveOpeningPlacement } from '@/canvas/editor-v2/opening-placement';

const room = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true);
it('alinea el centro de un objeto con centros y extremos aunque las huellas sean distintas', () => {
  const doc = emptyEditorDocument();
  doc.furniture.push({ id: 'a', kind: 'mesa', x: 1000, y: 1000, widthMm: 1000, depthMm: 1000, rotation: 0, dimensionalOrigin: 'physical' });
  const anchors = footprintAnchors({ x: 1340, y: 3500, widthMm: 400, depthMm: 400, rotation: 0 });
  const result = alignPoints(doc, anchors, .1, true);
  expect(result.delta.x).toBe(-40);
  expect(result.guides[0]!.from.x).toBe(1500);
  expect(result.guides[0]!.to.y).toBeGreaterThan(3500);
  expect(alignPoints(doc, anchors, .1, false)).toEqual({ delta: { x: 0, y: 0 }, guides: [] });
});
it('guías de etiquetas, luminarias y medidas con alcance constante en píxeles', () => {
  const doc = emptyEditorDocument(); doc.labels.push({ id: 'label', text: 'Eje', x: 1200, y: 1800 });
  doc.dimensions.push({ id: 'dim', from: { x: 4000, y: 2000 }, to: { x: 6000, y: 2000 } });
  for (const scale of [.02, .1, .5]) {
    expect(alignPoint(doc, { x: 1200 + 9 / scale, y: 8000 }, scale, true).point.x).toBe(1200);
    expect(alignPoint(doc, { x: 1200 + 11 / scale, y: 8000 }, scale, true).point.x).not.toBe(1200);
  }
  expect(magneticReferences(doc)).toContainEqual({ x: 5000, y: 2000 });
});
it('ventanas se alinean al centro del muro sin perder el anfitrión', () => {
  const doc = room(), wall = doc.walls[0]!;
  const opening = { id: 'window', wallId: wall.id, kind: 'ventana' as const, position: .5, widthMm: 1000, dimensionalOrigin: 'physical' as const };
  const placed = resolveOpeningPlacement(doc, { x: 3030, y: 0 }, .1, opening, wall.id, 0, true)!;
  expect(placed.center.x).toBe(3000); expect(placed.wallId).toBe(wall.id); expect(placed.guides?.length).toBeGreaterThan(0);
  expect(resolveOpeningPlacement(doc, { x: 3030, y: 0 }, .1, opening, wall.id, 0, false)!.center.x).toBe(3030);
});
it('flechas mueven muros sin desplazar dos veces el vértice compartido', () => {
  const doc = room(), moved = nudgeSpatialEntities(doc, [doc.walls[0]!.id, doc.walls[1]!.id], { x: 10, y: 0 });
  expect(moved.vertices.find((v) => v.id === doc.walls[0]!.endVertexId)!.x).toBe(6010);
});
it('flechas mueven texto, cotas y aberturas a lo largo del muro', () => {
  const doc = room();
  doc.labels.push({ id: 'text', text: 'Salón', x: 500, y: 500 });
  doc.dimensions.push({ id: 'dim', from: { x: 100, y: 100 }, to: { x: 1000, y: 100 } });
  doc.openings.push({ id: 'door', wallId: doc.walls[0]!.id, kind: 'puerta', position: .5, widthMm: 900, dimensionalOrigin: 'physical' });
  const moved = nudgeSpatialEntities(doc, ['text', 'dim', 'door'], { x: 100, y: 0 });
  expect(moved.labels[0]!.x).toBe(600); expect(moved.dimensions[0]!.from.x).toBe(200);
  expect(moved.openings[0]!.position).toBeCloseTo(.5 + 100 / 6000);
});
it('flechas mueven un patio y su etiqueta conservando el acabado', () => {
  const doc = addOutdoorArea(emptyEditorDocument(), { x: 0, y: 0 }, { x: 3000, y: 3000 });
  const moved = nudgeSpatialEntities(doc, [deriveRooms(doc)[0]!.id], { x: 10, y: 0 });
  expect(moved.vertices[0]!.x).toBe(10); expect(moved.labels[0]!.x).toBe(1510);
  expect(moved.floorFinishes).toEqual(doc.floorFinishes);
});
