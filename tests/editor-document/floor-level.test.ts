import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath, addOpening } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { setFloorFinish, floorFinish } from '@/lib/editor-document/floor-finishes';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { wallConstruction } from '@/lib/editor-document/construction-properties';
import { placeOpening, resolveOpeningPlacement } from '@/canvas/editor-v2/opening-placement';
import type { Opening } from '@/lib/editor-document/schema';

function raisedHouse() {
  const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 5000 }, { x: 0, y: 5000 }], true);
  return setFloorFinish(doc, deriveRooms(doc)[0]!.id, { elevationMm: 1000, texture: 'polyhaven:kitchen_wood' });
}

it('dividir una estancia elevada: las hijas heredan suelo y cota, y el tabique nace a la altura de la estancia', () => {
  const store = createEditorStore(raisedHouse());
  const before = wallConstruction(store.getState().document.walls[0]!).heightMm;
  store.getState().apply(addWallPath(store.getState().document, [{ x: 4000, y: 0 }, { x: 4000, y: 5000 }], false));
  const doc = store.getState().document, rooms = deriveRooms(doc);
  expect(rooms).toHaveLength(2);
  for (const room of rooms) {
    expect(floorFinish(doc, room.id).elevationMm).toBe(1000);
    expect(floorFinish(doc, room.id).texture).toBe('polyhaven:kitchen_wood');
  }
  const partition = doc.walls.find((w) => doc.vertices.find((v) => v.id === w.startVertexId)!.x === 4000 && doc.vertices.find((v) => v.id === w.endVertexId)!.x === 4000)!;
  expect(wallConstruction(partition).heightMm).toBe(before);
});

it('una puerta nueva arranca en el suelo elevado y cabe en el muro; la ventana queda a 0,90 m sobre él', () => {
  let doc = raisedHouse();
  const south = doc.walls.find((w) => [w.startVertexId, w.endVertexId].every((id) => doc.vertices.find((v) => v.id === id)!.y === 5000))!;
  doc = addOpening(doc, south.id, { x: 2000, y: 5000 }, 'puerta');
  doc = addOpening(doc, south.id, { x: 6000, y: 5000 }, 'ventana');
  expect(doc.openings.map((o) => o.elevationMm)).toEqual([1000, 1900]);
  // Colocación interactiva: la previsualización acepta el muro y el resultado queda a la misma cota.
  const prototype: Opening = { id: 'p2', kind: 'puerta', wallId: '', position: .5, widthMm: 900, dimensionalOrigin: 'physical' };
  const placement = resolveOpeningPlacement(doc, { x: 4000, y: 5000 }, .1, prototype);
  expect(placement?.valid).toBe(true);
  const placed = placeOpening(doc, prototype, placement!);
  expect(placed.openings.find((o) => o.id === 'p2')!.elevationMm).toBe(1000);
  expect(() => createEditorStore(doc).getState().apply(placed)).not.toThrow();
});
