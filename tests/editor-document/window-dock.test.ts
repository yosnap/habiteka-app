import { expect, it } from 'vitest';
import { emptyEditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { snapObject } from '@/canvas/editor-v2/spatial-placement';
import { insertSpatialItem } from '@/canvas/editor-v2/spatial-clipboard';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { objectCenter } from '@/lib/editor-document/spatial-properties';
import { wallPath } from '@/lib/editor-document/wall-path';

const house = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 4000 }, { x: 0, y: 4000 }], true);
const piece = (id: string, kind: string, x: number, y: number, extra: Partial<Furniture> = {}): Furniture => {
  const entry = getFurnitureCatalogEntry(`habiteka:furniture:${kind}`)!;
  return { id, kind, catalogId: entry.id, x, y, widthMm: entry.widthMm, depthMm: entry.depthMm, heightMm: entry.heightMm, elevationMm: entry.elevationMm,
    rotation: 0, color: entry.color, dimensionalOrigin: 'physical', ...extra };
};

it('un estor soltado cerca de una ventana se centra en ella, la cubre y arranca bajo el alféizar', () => {
  let doc = house(); doc = addOpening(doc, doc.walls[0]!.id, { x: 3000, y: 0 }, 'ventana');
  const window = doc.openings[0]!, t = doc.walls[0]!.thicknessMm / 2, windowCentre = wallPath(doc, doc.walls[0]!).at(window.position);
  const placed = snapObject(doc, piece('estor', 'estor-enrollable', 2200, t + 40), .08, true) as Furniture;
  expect(objectCenter(placed).x).toBeCloseTo(windowCentre.x, 0);
  expect(placed.y).toBeCloseTo(t);
  expect(placed.widthMm).toBeGreaterThanOrEqual(window.widthMm + 100);
  expect(placed.elevationMm).toBe((window.elevationMm ?? 900) - 100);
  expect(placed.elevationMm! + placed.heightMm!).toBeGreaterThanOrEqual((window.elevationMm ?? 900) + (window.heightMm ?? 1200) + 100);
  // Lejos de cualquier ventana no cambia de medidas.
  const free = snapObject(doc, piece('estor2', 'estor-enrollable', 6000, t + 40), .08, true) as Furniture;
  expect(free.widthMm).toBe(1200); expect(free.elevationMm).toBe(900);
});

it('una cortina se centra en la ventana, arranca del suelo de la estancia y no asoma sobre el muro', async () => {
  const { deriveRooms } = await import('@/lib/editor-document/rooms');
  const { setFloorFinish } = await import('@/lib/editor-document/floor-finishes');
  const { normalizeEditorDocument } = await import('@/lib/editor-document/document-normalization');
  let doc = house(); doc = setFloorFinish(doc, deriveRooms(doc)[0]!.id, { elevationMm: 1000 });
  doc = addOpening(doc, doc.walls[0]!.id, { x: 5000, y: 0 }, 'ventana');
  const window = doc.openings[0]!, wall = doc.walls[0]!, t = wall.thicknessMm / 2, wallTop = (wall.baseElevationMm ?? 0) + wall.heightMm!;
  const placed = snapObject(doc, piece('cortina', 'cortina-abierta', 4300, t + 60), .08, true) as Furniture;
  expect(objectCenter(placed).x).toBeCloseTo(wallPath(doc, wall).at(window.position).x, 0);
  expect(placed.elevationMm).toBe(1000);
  expect(placed.elevationMm! + placed.heightMm!).toBeGreaterThanOrEqual((window.elevationMm ?? 0) + (window.heightMm ?? 0) + 100);
  expect(placed.elevationMm! + placed.heightMm!).toBeLessThanOrEqual(wallTop);
  // El saneamiento del suelo no la vuelve a subir.
  const rested = normalizeEditorDocument(insertSpatialItem(doc, placed)).furniture.find((f) => f.id === 'cortina')!;
  expect(rested.elevationMm).toBe(1000);
});

it('el aviso de colisión nombra los dos elementos y la profundidad', () => {
  const doc = house(), t = doc.walls[0]!.thicknessMm / 2;
  const withWardrobe = insertSpatialItem(doc, piece('armario', 'armario', 2000, t));
  const store = createEditorStore(withWardrobe);
  // Estor colgado donde ya hay un armario de 2,20 m contra la pared.
  expect(() => store.getState().apply(insertSpatialItem(withWardrobe, piece('estor', 'estor-enrollable', 2400, t)))).toThrow(/«(Estor enrollable|Armario de dos puertas)» atraviesa «(Armario de dos puertas|Estor enrollable)» \(\d+ cm\)/);
});

it('la cobertura regula cuánto baja el estor o cuánto se corren las cortinas; al 100 % tapa la ventana entera', async () => {
  const { furnitureVolumes } = await import('@/lib/editor-document/furniture-volumes');
  const { updateFurniture } = await import('@/lib/editor-document/spatial-commands');
  const { windowCoverage } = await import('@/lib/editor-document/furniture-profiles');
  const { parseEditorDocument } = await import('@/lib/editor-document/validation');
  const estor = piece('estor', 'estor-enrollable', 2000, 100);
  expect(windowCoverage(estor)).toBe(1);
  const closed = furnitureVolumes(estor), lowest = Math.min(...closed.map((v) => v.bottom));
  expect(lowest - estor.elevationMm!).toBeLessThanOrEqual(estor.heightMm! * .03);
  const half = furnitureVolumes({ ...estor, coverage: .5 });
  expect(Math.min(...half.map((v) => v.bottom)) - estor.elevationMm!).toBeCloseTo(estor.heightMm! * (.95 - .465), -1);
  expect(furnitureVolumes({ ...estor, coverage: 0 })).toHaveLength(1);
  const curtain = piece('cortina', 'cortina-abierta', 0, 100);
  expect(windowCoverage(curtain)).toBe(.4);
  const drawn = furnitureVolumes({ ...curtain, coverage: 1 }).filter((v) => v.top < curtain.heightMm! * .97 + 1);
  expect(drawn).toHaveLength(10);
  const doc = insertSpatialItem(house(), estor);
  expect(updateFurniture(doc, 'estor', { coverage: .25 }).furniture[0]!.coverage).toBe(.25);
  expect(() => parseEditorDocument({ ...doc, furniture: [{ ...estor, coverage: 1.5 }] })).toThrow(/cobertura/);
});
