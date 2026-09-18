import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { OUTDOOR_CATALOG } from '@/lib/editor-document/outdoor-catalog';
import { OUTDOOR_MATERIALS } from '@/lib/editor-document/outdoor-materials';
import { addFurniture, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { eligibleCeilingRooms } from '@/lib/editor-document/ceiling-geometry';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { existsSync } from 'node:fs';

it('crea patio abierto con suelo editable sin techo ni muros 3D, persistido y reversible', () => {
  const source = emptyEditorDocument(), doc = addOutdoorArea(source, { x: 0, y: 0 }, { x: 5000, y: 4000 });
  expect(source.walls).toEqual([]);
  expect(deriveRooms(doc)).toHaveLength(1);
  expect(eligibleCeilingRooms(doc)).toHaveLength(0);
  const scene = editorDocumentToScene(doc);
  expect(scene.warnings).toEqual([]);
  expect(scene.boxes.filter((box) => box.role === 'wall')).toHaveLength(0);
  expect(scene.polygons.some((polygon) => polygon.role === 'floor')).toBe(true);
  expect(parseEditorDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  const store = createEditorStore(source); store.getState().apply(doc); store.getState().undo();
  expect(store.getState().document).toEqual(source); store.getState().redo();
  expect(store.getState().document).toEqual(doc);
});

it('comparte muro existente con la casa sin ocultarlo ni duplicarlo', () => {
  const source = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], true);
  const doc = addOutdoorArea(source, { x: 4000, y: 0 }, { x: 7000, y: 3000 });
  expect(deriveRooms(doc)).toHaveLength(2);
  expect(doc.walls).toHaveLength(7);
  expect(doc.walls.filter((wall) => !wall.hidden)).toHaveLength(4);
  expect(eligibleCeilingRooms(doc)).toHaveLength(1);
  expect(() => addOutdoorArea(doc, { x: 4000, y: 0 }, { x: 7000, y: 3000 })).toThrow();
});

describe('catálogo y texturas exteriores', () => {
  for (const item of OUTDOOR_CATALOG) it(`persiste ${item.label} con geometría propia`, () => {
    const doc = addFurniture(emptyEditorDocument(), item, { x: 1000, y: 1000 });
    const object = doc.furniture[0]!;
    const volumes = furnitureVolumes(object);
    expect(volumes.length).toBeGreaterThan(1);
    expect(volumes.every((v) => v.widthMm > 0 && v.depthMm > 0 && v.top > v.bottom)).toBe(true);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    expect(editorDocumentToScene(doc).boxes.filter((box) => box.sourceEntityId === object.id)).toHaveLength(volumes.length);
  });
  for (const material of OUTDOOR_MATERIALS) it(`aplica ${material.label} con archivos locales`, () => {
    const doc = addOutdoorArea(emptyEditorDocument(), { x: 0, y: 0 }, { x: 5000, y: 4000 });
    const changed = setFloorFinish(doc, deriveRooms(doc)[0]!.id, { texture: material.id as `outdoor:${string}` });
    expect(changed.floorFinishes![0]!.texture).toBe(material.id);
    for (const path of Object.values(material.maps)) expect(existsSync(`public${path}`)).toBe(true);
  });
});

it('sitúa la barbacoa en el patio en lugar de la primera habitación interior', () => {
  const house = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
  const patio = addOutdoorArea(house, { x: 4000, y: 0 }, { x: 8000, y: 4000 });
  const doc = addFurniture(patio, OUTDOOR_CATALOG.find((item) => item.kind === 'barbacoa')!, { x: 0, y: 0 });
  expect(doc.furniture[0]!.x).toBeGreaterThan(4000);
});

it('permite aparcar sobre las marcas del parking sin desplazar el coche', async () => {
  const { placeNewObject } = await import('@/canvas/editor-v2/spatial-placement');
  const source = addFurniture(emptyEditorDocument(), OUTDOOR_CATALOG.find((item) => item.kind === 'parking')!, { x: 0, y: 0 });
  const doc = addFurniture(source, OUTDOOR_CATALOG.find((item) => item.kind === 'coche')!, { x: 100, y: 100 });
  const car = doc.furniture[1]!;
  const placed = placeNewObject(source, doc, car.id).furniture[1]!;
  expect([placed.x, placed.y]).toEqual([car.x, car.y]);
});

it('permite caminar bajo la pérgola pero evita sus postes', async () => {
  const { walkthroughNavigation } = await import('@/lib/editor-document/walkthrough-navigation');
  const patio = addOutdoorArea(emptyEditorDocument(), { x: 0, y: 0 }, { x: 10000, y: 10000 });
  const doc = addFurniture(patio, OUTDOOR_CATALOG.find((item) => item.kind === 'pergola')!, { x: 1000, y: 1000 });
  const pergola = doc.furniture[0]!, nav = walkthroughNavigation(doc);
  expect(nav.free({ x: pergola.x + pergola.widthMm / 2, y: pergola.y + pergola.depthMm / 2 })).toBe(true);
  expect(nav.free({ x: pergola.x + 30, y: pergola.y + 30 })).toBe(false);
});

it('mueve patio independiente y su etiqueta, conserva acabado y permite deshacer', async () => {
  const { moveOutdoorRoom } = await import('@/lib/editor-document/outdoor-editing');
  const doc = addOutdoorArea(emptyEditorDocument(), { x: 0, y: 0 }, { x: 4000, y: 3000 });
  const id = deriveRooms(doc)[0]!.id;
  const moved = moveOutdoorRoom(doc, id, { x: 1000, y: 500 });
  expect(moved.vertices[0]!.x).toBe(doc.vertices[0]!.x + 1000);
  expect(moved.labels[0]!.x).toBe(doc.labels[0]!.x + 1000);
  expect(moved.floorFinishes).toEqual(doc.floorFinishes);
  const store = createEditorStore(doc); store.getState().apply(moved); store.getState().undo();
  expect(store.getState().document).toEqual(doc);
});

it('mover/eliminar patio adosado preserva la casa y su pared compartida', async () => {
  const { moveOutdoorRoom, deleteOutdoorRoom } = await import('@/lib/editor-document/outdoor-editing');
  const house = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], true);
  const doc = addOutdoorArea(house, { x: 4000, y: 0 }, { x: 7000, y: 3000 });
  const id = deriveRooms(doc).find((r) => r.wallIds.some((w) => w.startsWith('outdoor:')))!.id;
  const moved = moveOutdoorRoom(doc, id, { x: 500, y: 0 });
  expect(moved.vertices.filter((v) => house.vertices.some((p) => p.id === v.id))).toEqual(house.vertices);
  expect(deleteOutdoorRoom(moved, id).walls).toEqual(doc.walls.filter((w) => !w.id.startsWith('outdoor:')));
  expect(deriveRooms(deleteOutdoorRoom(moved, id))).toHaveLength(1);
});
