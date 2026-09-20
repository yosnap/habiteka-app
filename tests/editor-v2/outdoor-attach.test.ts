import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addOutdoorEdge } from '@/lib/editor-document/outdoor-area';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { moveOutdoorRoom } from '@/lib/editor-document/outdoor-editing';
import { deriveRooms, RoomConflictError } from '@/lib/editor-document/rooms';
import { alignRoom } from '@/canvas/editor-v2/magnetic-alignment';
import { previewVertex } from '@/canvas/editor-v2/vertex-preview';
import { mergeVertexInto } from '@/lib/editor-document/vertex-merge';

/** Casa con saliente y terraza con muesca dibujada debajo, como en el plano real. */
function houseWithTerrace() {
  let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 3000 }, { x: 6200, y: 3000 },
    { x: 6200, y: 4500 }, { x: 3000, y: 4500 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }], true);
  doc = addWallPath(doc, [{ x: 3000, y: 3000 }, { x: 6200, y: 3000 }], false);
  const pts = [{ x: 0, y: 6000 }, { x: 3000, y: 6000 }, { x: 3000, y: 7500 }, { x: 6200, y: 7500 }, { x: 6200, y: 6000 },
    { x: 8000, y: 6000 }, { x: 8000, y: 9000 }, { x: 0, y: 9000 }, { x: 0, y: 6000 }];
  for (let i = 1; i < pts.length; i++) doc = addOutdoorEdge(doc, pts[i - 1]!, pts[i]!);
  const terrace = deriveRooms(doc).find((r) => r.wallIds.some((w) => w.startsWith('outdoor:')))!;
  return { doc, terrace };
}

it('los imanes pegan la muesca de la terraza a la fachada del saliente', () => {
  const { doc, terrace } = houseWithTerrace();
  // La esquina interior de la muesca (3000, 7500) queda a 25 mm de la cara exterior del saliente (y = 4575).
  const { delta } = alignRoom(doc, terrace.id, { x: 0, y: -2900 }, .1, true);
  expect(delta.y).toBe(-2925);
  const moved = moveOutdoorRoom(doc, terrace.id, delta);
  expect(deriveRooms(moved)).toHaveLength(3);
});

it('un movimiento que invade la casa explica cómo pegar la terraza', () => {
  const { doc, terrace } = houseWithTerrace();
  expect(() => moveOutdoorRoom(doc, terrace.id, { x: 0, y: -3500 })).toThrow(/imanes|vértices/);
});

it('soltar un vértice del patio sobre una esquina de la casa fusiona ambos y comparte el muro', () => {
  const source = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], true);
  let doc = source;
  const pts = [{ x: 0, y: 3200 }, { x: 4000, y: 3200 }, { x: 4000, y: 6000 }, { x: 0, y: 6000 }, { x: 0, y: 3200 }];
  for (let i = 1; i < pts.length; i++) doc = addOutdoorEdge(doc, pts[i - 1]!, pts[i]!);
  const corner = (x: number, y: number) => doc.vertices.find((v) => v.x === x && v.y === y)!;
  const first = previewVertex(doc, corner(0, 3200).id, { x: 2, y: 3003 }, 1, true);
  expect(first.error).toBeNull();
  expect(first.document.vertices.some((v) => v.id === corner(0, 3200).id)).toBe(false);
  const second = previewVertex(first.document, first.document.vertices.find((v) => v.x === 4000 && v.y === 3200)!.id, { x: 4001, y: 2998 }, 1, true);
  expect(second.error).toBeNull();
  // El tramo oculto del patio que caía sobre el muro sur desaparece: la casa y el patio comparten ese muro.
  expect(second.document.walls).toHaveLength(7);
  expect(second.document.walls.filter((w) => !w.hidden)).toHaveLength(4);
  expect(deriveRooms(second.document)).toHaveLength(2);
});

it('la fusión conserva el muro visible y elimina los huecos del tramo descartado', () => {
  const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }], false);
  const withEdge = addOutdoorEdge(doc, { x: 0, y: 0 }, { x: 4000, y: 200 });
  const far = withEdge.vertices.find((v) => v.y === 200)!, target = withEdge.vertices.find((v) => v.x === 4000 && v.y === 0)!;
  const merged = mergeVertexInto(withEdge, far.id, target.id);
  expect(merged.walls).toHaveLength(1);
  expect(merged.walls[0]!.hidden).toBeUndefined();
  expect(merged.vertices).toHaveLength(2);
});

it('al soltar la terraza pegada a la fachada se acopla: comparte muros y conserva el suelo', () => {
  const { doc, terrace } = houseWithTerrace();
  const { delta } = alignRoom(doc, terrace.id, { x: 0, y: -2900 }, .1, true);
  const moved = moveOutdoorRoom(doc, terrace.id, delta);
  const rooms = deriveRooms(moved), patio = rooms.find((r) => r.wallIds.some((w) => w.startsWith('outdoor:')))!;
  expect(rooms).toHaveLength(3);
  // Los cuatro tramos de la muesca y los dos superiores caían sobre muros reales: desaparecen y se comparten.
  expect(moved.walls.filter((w) => w.id.startsWith('outdoor:'))).toHaveLength(3);
  expect(patio.wallIds.filter((w) => !w.startsWith('outdoor:'))).toHaveLength(5);
  expect(moved.floorFinishes?.find((f) => f.roomId === patio.id)?.texture).toBe('outdoor:paving');
  expect(moved.floorFinishes?.some((f) => f.roomId === terrace.id)).toBe(false);
});

it('un patio que apoya en mitad de una fachada divide el muro y lo comparte', () => {
  const house = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 3000 }, { x: 0, y: 3000 }], true);
  let doc = house;
  const pts = [{ x: 2000, y: 3300 }, { x: 5000, y: 3300 }, { x: 5000, y: 6000 }, { x: 2000, y: 6000 }, { x: 2000, y: 3300 }];
  for (let i = 1; i < pts.length; i++) doc = addOutdoorEdge(doc, pts[i - 1]!, pts[i]!);
  const patio = deriveRooms(doc).find((r) => r.wallIds.some((w) => w.startsWith('outdoor:')))!;
  const { delta } = alignRoom(doc, patio.id, { x: 0, y: -200 }, .1, true);
  expect(delta.y).toBe(-225);
  const moved = moveOutdoorRoom(doc, patio.id, delta);
  const rooms = deriveRooms(moved);
  expect(rooms).toHaveLength(2);
  // El muro sur queda partido en tres tramos y el patio comparte el central.
  expect(moved.walls.filter((w) => !w.id.startsWith('outdoor:'))).toHaveLength(6);
  expect(moved.walls.filter((w) => w.id.startsWith('outdoor:'))).toHaveLength(3);
  expect(moved.vertices.some((v) => v.x === 2000 && v.y === 3000)).toBe(true);
});

it('mover una selección con patio, muros y muebles desplaza todo a la vez', async () => {
  const { nudgeSpatialEntities, addFurniture } = await import('@/canvas/editor-v2/editing-operations');
  const { OUTDOOR_CATALOG } = await import('@/lib/editor-document/outdoor-catalog');
  const { doc, terrace } = houseWithTerrace();
  const withItem = addFurniture(doc, OUTDOOR_CATALOG[0]!, { x: 1000, y: 8000 });
  const item = withItem.furniture.at(-1) ?? withItem.boundaries!.at(-1)!;
  const ids = [terrace.id, ...withItem.walls.filter((w) => !w.id.startsWith('outdoor:')).map((w) => w.id), item.id];
  const moved = nudgeSpatialEntities(withItem, ids, { x: 500, y: 0 });
  expect(moved.vertices.every((v, i) => v.x === withItem.vertices[i]!.x + 500)).toBe(true);
  const movedItem = moved.furniture.find((f) => f.id === item.id) ?? moved.boundaries?.find((b) => b.id === item.id);
  expect(movedItem?.x).toBe(item.x + 500);
  expect(deriveRooms(moved)).toHaveLength(3);
});

it('una pared colgante dentro de una estancia no rompe la derivación ni oculta los suelos', () => {
  const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], true);
  // Tabique que arranca en una esquina y muere dentro de la estancia sin cerrar nada.
  doc.vertices.push({ id: 'stub-end', x: 1000, y: 1000 });
  doc.walls.push({ ...structuredClone(doc.walls[0]!), id: 'stub', startVertexId: doc.walls[0]!.startVertexId, endVertexId: 'stub-end' });
  const rooms = deriveRooms(doc);
  expect(rooms).toHaveLength(1);
  expect(rooms[0]!.wallIds.every((id) => doc.walls.some((w) => w.id === id))).toBe(true);
  expect(rooms[0]!.areaMm2).toBeCloseTo(12e6, -3);
});

it('el conflicto de contornos indica el punto exacto para señalarlo en el plano', () => {
  const { doc, terrace } = houseWithTerrace();
  let caught: unknown;
  try { moveOutdoorRoom(doc, terrace.id, { x: 0, y: -3500 }); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(RoomConflictError);
  expect((caught as RoomConflictError).message).toMatch(/Choca en \(/);
  expect((caught as RoomConflictError).point).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
});

it('mover un patio acoplado lo despega entero, conserva su forma y vuelve a acoplarse al acercarlo', () => {
  const { doc, terrace } = houseWithTerrace();
  const attached = moveOutdoorRoom(doc, terrace.id, alignRoom(doc, terrace.id, { x: 0, y: -2900 }, .1, true).delta);
  const glued = deriveRooms(attached).find((r) => r.wallIds.some((w) => w.startsWith('outdoor:')))!;
  expect(glued.wallIds.filter((w) => !w.startsWith('outdoor:'))).toHaveLength(5);
  const away = moveOutdoorRoom(attached, glued.id, { x: 0, y: 4000 });
  const free = deriveRooms(away).find((r) => r.wallIds.some((w) => w.startsWith('outdoor:')))!;
  expect(free.areaMm2).toBeCloseTo(glued.areaMm2, -3);
  expect(free.wallIds.every((w) => w.startsWith('outdoor:'))).toBe(true);
  expect(deriveRooms(away)).toHaveLength(3);
  expect(away.floorFinishes?.find((f) => f.roomId === free.id)?.texture).toBe('outdoor:paving');
  // La casa no se ha movido ni ha perdido muros.
  expect(away.walls.filter((w) => !w.id.startsWith('outdoor:'))).toHaveLength(attached.walls.filter((w) => !w.id.startsWith('outdoor:')).length);
});
