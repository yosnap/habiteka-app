import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addRamp } from '@/lib/editor-document/construction-commands';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { wallConstruction } from '@/lib/editor-document/construction-properties';

/** Baño exterior cerrado por tres muros desde el terreno y un cuarto que se traza sobre el borde de un descansillo a 1 m. */
function bathroomOnLanding() {
  const doc = addRamp(emptyEditorDocument(), { id: 'descanso', catalogId: 'builtin:ramp-landing', x: 0, y: 3000, widthMm: 3000, depthMm: 1500,
    elevationMm: 1000, riseMm: 0, rotation: 0, materialId: 'concrete-grey' });
  const store = createEditorStore(doc);
  // El muro sobre el borde del descansillo se retranquea a su superficie; los otros tres parten de sus extremos.
  store.getState().apply(addWallPath(store.getState().document, [{ x: 0, y: 3000 }, { x: 3000, y: 3000 }]));
  const onLanding = store.getState().document.walls[0]!, current = store.getState().document;
  const a = current.vertices.find((v) => v.id === onLanding.startVertexId)!, b = current.vertices.find((v) => v.id === onLanding.endVertexId)!;
  store.getState().apply(addWallPath(current, [{ x: b.x, y: b.y }, { x: b.x, y: 0 }, { x: a.x, y: 0 }, { x: a.x, y: a.y }]));
  return store;
}

it('un muro trazado sobre un descansillo nace con base en su cota', () => {
  const doc = bathroomOnLanding().getState().document;
  const onLanding = doc.walls.find((w) => (w.baseElevationMm ?? 0) > 0)!;
  expect(onLanding.baseElevationMm).toBe(1000);
  expect(deriveRooms(doc)).toHaveLength(1);
});

it('subir la cota del baño a la del descansillo conserva la base del muro apoyado y no colisiona', () => {
  const store = bathroomOnLanding(), doc = store.getState().document, room = deriveRooms(doc)[0]!;
  const before = doc.walls.find((w) => (w.baseElevationMm ?? 0) > 0)!;
  expect(() => store.getState().apply(setFloorFinish(doc, room.id, { elevationMm: 1000 }))).not.toThrow();
  const after = store.getState().document, wall = after.walls.find((w) => w.id === before.id)!;
  expect(wall.baseElevationMm).toBe(1000);
  expect(wallConstruction(wall).heightMm).toBe(wallConstruction(before).heightMm);
  // Los muros que arrancan del terreno crecen la cota del suelo para coronar a la misma altura.
  const ground = after.walls.find((w) => w.id !== wall.id)!;
  expect(wallConstruction(ground).heightMm).toBe(wallConstruction(wall).heightMm + 1000);
});

it('una puerta a ras del suelo elevado cabe en el muro apoyado en el descansillo', async () => {
  const { resolveOpeningPlacement, placeOpening } = await import('@/canvas/editor-v2/opening-placement');
  const { wallPoints } = await import('@/lib/editor-document/geometry');
  const store = bathroomOnLanding(), room = deriveRooms(store.getState().document)[0]!;
  store.getState().apply(setFloorFinish(store.getState().document, room.id, { elevationMm: 1000 }));
  const doc = store.getState().document, wall = doc.walls.find((w) => (w.baseElevationMm ?? 0) === 1000)!, [a, b] = wallPoints(doc, wall);
  const door = { id: 'puerta', kind: 'puerta' as const, wallId: '', position: .5, widthMm: 900, dimensionalOrigin: 'physical' as const };
  const placement = resolveOpeningPlacement(doc, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, .08, door)!;
  expect(placement.wallId).toBe(wall.id);
  expect(placement.reason).toBeNull();
  const placed = placeOpening(doc, door, placement).openings.find((o) => o.id === 'puerta')!;
  expect(placed.elevationMm).toBe(1000); expect(placed.heightMm).toBe(2100);
  expect(() => store.getState().apply(placeOpening(doc, door, placement))).not.toThrow();
});
