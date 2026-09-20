import { expect, it } from 'vitest';
import { emptyEditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { insertSpatialItem } from '@/canvas/editor-v2/spatial-clipboard';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { snapObject } from '@/canvas/editor-v2/spatial-placement';
import { alignBackToWall } from '@/canvas/editor-v2/wall-back-alignment';
import { restOnHost } from '@/lib/editor-document/object-host-rest';
import { normalizeEditorDocument } from '@/lib/editor-document/document-normalization';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { nudgeElements } from '@/canvas/editor-v2/nudge-elements';
import { addKitchenRun } from '@/lib/editor-document/kitchen-run-commands';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';

const house = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 4000 }, { x: 0, y: 4000 }], true);
const piece = (id: string, kind: string, x: number, y: number, size: [number, number, number], extra: Partial<Furniture> = {}): Furniture =>
  ({ id, kind, catalogId: `habiteka:furniture:${kind}`, x, y, widthMm: size[0], depthMm: size[1], heightMm: size[2], rotation: 0, elevationMm: 0, color: '#8ea69b', dimensionalOrigin: 'physical', ...extra });
const cabinet = () => piece('mueble', 'mueble-tv', 2000, 2000, [1600, 400, 500], { rotation: 30 });
// Televisor centrado sobre el mueble (sin girar todavía).
const tv = () => { const c = localToWorld(cabinet(), { x: 800, y: 200 }); return piece('tv', 'televisor', c.x - 600, c.y - 125, [1200, 250, 750]); };

it('un televisor soltado sobre un mueble toma la cota de su cara superior, su orientación y no colisiona con él', () => {
  const doc = insertSpatialItem(house(), cabinet()), store = createEditorStore(doc);
  const placed = snapObject(doc, tv(), .08, true) as Furniture;
  expect(placed.hostId).toBe('mueble'); expect(placed.elevationMm).toBe(500); expect(placed.rotation).toBe(30);
  expect(() => store.getState().apply(insertSpatialItem(doc, placed))).not.toThrow();
  const saved = store.getState().document.furniture.find((f) => f.id === 'tv')!;
  expect(saved.elevationMm).toBe(500); expect(saved.hostId).toBe('mueble');
});

it('el saneamiento apoya lo que ya está encima, sigue a la altura del mueble y devuelve al suelo lo que se retira', () => {
  let doc = normalizeEditorDocument(insertSpatialItem(insertSpatialItem(house(), cabinet()), tv()));
  expect(doc.furniture.find((f) => f.id === 'tv')!.elevationMm).toBe(500);
  expect(doc.furniture.find((f) => f.id === 'tv')!.hostId).toBe('mueble');
  doc = normalizeEditorDocument(updateFurniture(doc, 'mueble', { heightMm: 700 }));
  expect(doc.furniture.find((f) => f.id === 'tv')!.elevationMm).toBe(700);
  // Una cota puesta a mano por encima del mueble se respeta mientras siga apoyado.
  doc = normalizeEditorDocument(updateFurniture(doc, 'tv', { elevationMm: 1200 }));
  expect(doc.furniture.find((f) => f.id === 'tv')!.elevationMm).toBe(1200);
  doc = normalizeEditorDocument(nudgeElements(doc, ['tv'], { x: 3000, y: 0 }));
  const dropped = doc.furniture.find((f) => f.id === 'tv')!;
  expect(dropped.hostId).toBeUndefined(); expect(dropped.elevationMm).toBe(0);
  // En una estancia con suelo elevado, el que baja del mueble cae al suelo de la estancia, no a cero.
  const room = deriveRooms(doc)[0]!;
  const raised = normalizeEditorDocument(setFloorFinish(doc, room.id, { elevationMm: 300 }));
  expect(raised.furniture.find((f) => f.id === 'tv')!.elevationMm).toBe(300);
  expect(raised.furniture.find((f) => f.id === 'mueble')!.elevationMm).toBe(300);
});

it('un microondas sobre la encimera se apoya en el mueble de cocina y sube con la cota del suelo', () => {
  const h = house(), t = h.walls[0]!.thicknessMm / 2;
  let doc = addKitchenRun(h, { x: t, y: t }, { x: t + 3000, y: t });
  const run = doc.kitchenRuns![0]!, spot = localToWorld(run, { x: 1500, y: 300 });
  doc = normalizeEditorDocument(insertSpatialItem(doc, piece('micro', 'microondas', spot.x - 250, spot.y - 200, [500, 400, 300])));
  expect(doc.furniture.find((f) => f.id === 'micro')!.elevationMm).toBe(900);
  const room = deriveRooms(doc)[0]!;
  doc = normalizeEditorDocument(setFloorFinish(doc, room.id, { elevationMm: 400 }));
  expect(doc.kitchenRuns![0]!.elevationMm).toBe(400);
  expect(doc.furniture.find((f) => f.id === 'micro')!.elevationMm).toBe(1300);
});

it('un mueble que se acerca a un muro adopta su dirección con la trasera contra la cara, llegue como llegue', () => {
  const doc = house(), t = doc.walls[0]!.thicknessMm / 2;
  // Muro sur (y = 4000): la trasera debe quedar en y = 4000 − t mirando hacia −y (rotación 180).
  const near = alignBackToWall(doc, piece('sofa', 'sofa-3', 3000, 4000 - t - 950 - 60, [2300, 950, 850]), 200);
  expect(Math.abs(near.rotation) % 360).toBeCloseTo(180);
  const back = localToWorld(near, { x: 0, y: 0 });
  expect(back.y).toBeCloseTo(4000 - t);
  // Ya orientado correctamente hacia la estancia: solo se ajusta la distancia.
  const north = alignBackToWall(doc, piece('sofa2', 'sofa-3', 3000, t + 40, [2300, 950, 850]), 200);
  expect(north.rotation).toBe(0); expect(north.y).toBeCloseTo(t);
  // Llega perpendicular al muro oeste: adopta la dirección del muro con la trasera contra su cara.
  const desk = alignBackToWall(doc, piece('mesa', 'mesa-comedor', t + 30, 1000, [1600, 900, 750]), 200);
  expect(Math.abs(desk.rotation)).toBeCloseTo(90);
  expect(localToWorld(desk, { x: 0, y: 0 }).x).toBeCloseTo(t);
  expect(localToWorld(desk, { x: 0, y: desk.depthMm }).x).toBeCloseTo(t + 900);
  // Lejos de cualquier muro: no se toca.
  const far = piece('sofa3', 'sofa-3', 3000, 2000, [2300, 950, 850]);
  expect(alignBackToWall(doc, far, 200)).toEqual(far);
  expect(restOnHost(doc, far)).toEqual(far);
});

it('un aparato de pie con el centro sobre la encimera no se sube a ella; una planta o una lámpara pequeña sí', () => {
  const h = house(), t = h.walls[0]!.thicknessMm / 2;
  let doc = addKitchenRun(h, { x: t, y: t }, { x: t + 3000, y: t });
  const run = doc.kitchenRuns![0]!, spot = localToWorld(run, { x: 800, y: 300 });
  const cooker = piece('fogones', 'vitroceramica', spot.x - 300, spot.y - 300, [600, 600, 900]);
  expect(restOnHost(doc, cooker)).toEqual(cooker);
  const plant = piece('planta', 'planta-interior', spot.x - 200, spot.y - 200, [400, 400, 500]);
  expect(restOnHost(doc, plant).elevationMm).toBe(900);
  const fridge = piece('nevera', 'frigorifico', spot.x - 350, spot.y - 350, [700, 700, 1900]);
  expect(restOnHost(doc, fridge)).toEqual(fridge);
  doc = normalizeEditorDocument(insertSpatialItem(doc, { ...plant, hostId: undefined }));
  expect(doc.furniture.find((f) => f.id === 'planta')!.hostId).toBe(run.id);
});
