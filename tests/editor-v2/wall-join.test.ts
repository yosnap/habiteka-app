import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { previewVertex, previewWallAngles } from '@/canvas/editor-v2/vertex-preview';
import { addLinearBoundary } from '@/lib/editor-document/linear-boundary';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { addColumn } from '@/lib/editor-document/construction-commands';

const house = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 3000 }, { x: 0, y: 3000 }], true);

it('un tabique trazado hasta la cara de la fachada divide el muro y cierra la estancia', () => {
  // El hall se dibuja debajo de la casa; sus laterales terminan en la cara exterior del muro sur (y = 3075), no en su eje.
  const doc = addWallPath(house(), [{ x: 3000, y: 3075 }, { x: 3000, y: 5000 }, { x: 6000, y: 5000 }, { x: 6000, y: 3075 }], false);
  const rooms = deriveRooms(doc);
  expect(rooms.map((r) => Math.round(r.areaMm2 / 1e5) / 10).sort((a, b) => a - b)).toEqual([6, 24]);
  // El muro sur queda partido en tres tramos con dos vértices nuevos sobre su eje.
  expect(doc.vertices.filter((v) => v.y === 3000)).toHaveLength(4);
});

it('soltar el vértice de un muro suelto sobre otro muro lo une en T', () => {
  const doc = addWallPath(house(), [{ x: 3000, y: 3300 }, { x: 3000, y: 5000 }, { x: 6000, y: 5000 }, { x: 6000, y: 3300 }], false);
  expect(deriveRooms(doc)).toHaveLength(1);
  const loose = doc.vertices.find((v) => v.x === 3000 && v.y === 3300)!;
  const preview = previewVertex(doc, loose.id, { x: 3002, y: 3010 }, 1, true);
  expect(preview.error).toBeNull();
  expect(preview.document.vertices.some((v) => v.id === loose.id)).toBe(false);
  expect(preview.document.vertices.some((v) => v.x === 3000 && v.y === 3000)).toBe(true);
  const other = preview.document.vertices.find((v) => v.x === 6000 && v.y === 3300)!;
  const closed = previewVertex(preview.document, other.id, { x: 6000, y: 2995 }, 1, true);
  expect(closed.error).toBeNull();
  expect(deriveRooms(closed.document)).toHaveLength(2);
});

it('arrastrar un vértice sobre otro para unir tres muros muestra sus ángulos sin romper el editor', () => {
  // Un tabique suelto cuyo extremo se suelta sobre la esquina (0, 3000), donde ya se unen dos muros de la casa.
  const doc = addWallPath(house(), [{ x: 1500, y: 4500 }, { x: 300, y: 3300 }], false);
  const loose = doc.vertices.find((v) => v.x === 300 && v.y === 3300)!, wall = doc.walls.at(-1)!;
  const preview = previewVertex(doc, loose.id, { x: 5, y: 3004 }, 1, true);
  expect(preview.error).toBeNull();
  // El vértice arrastrado se fusiona con la esquina: el muro original ya no sirve para pintar la vista previa.
  expect(preview.document.vertices.some((v) => v.id === loose.id)).toBe(false);
  const corner = doc.vertices.find((v) => v.x === 0 && v.y === 3000)!;
  expect(preview.document.walls.filter((w) => w.startVertexId === corner.id || w.endVertexId === corner.id)).toHaveLength(3);
  const selected = [wall.id, doc.walls[0]!.id];
  expect(() => previewWallAngles(preview, selected)).not.toThrow();
  expect(previewWallAngles(preview, selected).find((label) => label.id === wall.id)?.degrees).toBeCloseTo(-135, 0);
});

it('una valla puede pasar por una columna, como un muro', () => {
  // Pilar a 40 cm de la fachada; la valla pasa por su centro sin tocar el muro.
  const column = { id: 'col', catalogId: 'builtin:column-rectangular' as const, x: 3800, y: -800, widthMm: 400, depthMm: 400, elevationMm: 0, heightMm: 1700, rotation: 0, materialId: 'concrete-grey' };
  const store = createEditorStore(addColumn(house(), column));
  expect(() => store.getState().apply(addLinearBoundary(store.getState().document, 'valla-madera', { x: 0, y: -600 }, { x: 8000, y: -600 }))).not.toThrow();
});

it('un borde de patio casi colineal en la esquina no invalida la ventana de la fachada', async () => {
  const { addOutdoorEdge } = await import('@/lib/editor-document/outdoor-area');
  const { assertOpeningClearance } = await import('@/lib/editor-document/opening-clearance');
  let doc = house();
  const south = doc.walls.find((w) => doc.vertices.find((v) => v.id === w.startVertexId)!.y === 3000 && doc.vertices.find((v) => v.id === w.endVertexId)!.y === 3000)!;
  doc = { ...doc, openings: [{ id: 'win', wallId: south.id, kind: 'ventana', position: .5, widthMm: 1200, dimensionalOrigin: 'physical' } as (typeof doc.openings)[number]] };
  expect(() => assertOpeningClearance(doc, doc.openings[0]!)).not.toThrow();
  // Un tramo oculto sale de la esquina (8000, 3000) casi paralelo a la fachada.
  doc = addOutdoorEdge(doc, { x: 8000, y: 3000 }, { x: 0, y: 3075 });
  expect(() => assertOpeningClearance(doc, doc.openings[0]!)).not.toThrow();
});

it('unir un muro a una esquina no reabre una holgura heredada de otra abertura', async () => {
  const { assertOpeningClearanceNotWorse, openingClearanceDeficitMm } = await import('@/lib/editor-document/opening-clearance');
  let doc = addWallPath(house(), [{ x: 4000, y: 0 }, { x: 4000, y: 3000 }], false);
  const inner = doc.walls.at(-1)!, length = 3000;
  // Puerta heredada a solo 40 mm de la esquina inferior del tabique (la holgura exige 75 mm).
  const door = { id: 'door', wallId: inner.id, kind: 'puerta', position: 1 - (40 + 400) / length, widthMm: 800, dimensionalOrigin: 'physical' } as (typeof doc.openings)[number];
  doc = { ...doc, openings: [door] };
  expect(openingClearanceDeficitMm(doc, door)).toBeGreaterThan(0);
  doc = addWallPath(doc, [{ x: 4000, y: 3300 }, { x: 4000, y: 5000 }], false);
  const loose = doc.vertices.find((v) => v.x === 4000 && v.y === 3300)!;
  const preview = previewVertex(doc, loose.id, { x: 4000, y: 3000 }, 1, true);
  expect(preview.error).toBeNull();
  expect(() => assertOpeningClearanceNotWorse(doc, preview.document, preview.document.openings[0]!)).not.toThrow();
});

it('una valla baja puede rematar contra un descansillo como un murete', async () => {
  const { addRamp } = await import('@/lib/editor-document/construction-commands');
  const doc = addRamp(house(), { id: 'landing', catalogId: 'builtin:ramp-landing', x: 8000, y: -2000, widthMm: 2000, depthMm: 2000,
    elevationMm: 1000, riseMm: 0, rotation: 0, materialId: 'concrete-grey' });
  const store = createEditorStore(doc);
  // La valla termina 40 mm dentro de la losa: contacto de remate, no un cruce.
  expect(() => store.getState().apply(addLinearBoundary(store.getState().document, 'valla-madera', { x: 2000, y: -1000 }, { x: 8040, y: -1000 }))).not.toThrow();
});

it('al cargar, un hall trazado hasta la cara de la fachada se cierra solo y recibe suelo', async () => {
  const { normalizeEditorDocument } = await import('@/lib/editor-document/document-normalization');
  // Montaje manual del caso real: laterales que terminan a 75 mm del eje del muro sur, sin unión.
  const doc = house();
  const v = (id: string, x: number, y: number) => doc.vertices.push({ id, x, y });
  v('h1', 3000, 3075); v('h2', 3000, 5000); v('h3', 6000, 5000); v('h4', 6000, 3075);
  const wall = (id: string, a: string, b: string) => doc.walls.push({ ...structuredClone(doc.walls[0]!), id, startVertexId: a, endVertexId: b });
  wall('hl', 'h1', 'h2'); wall('hb', 'h2', 'h3'); wall('hr', 'h3', 'h4');
  expect(deriveRooms(doc)).toHaveLength(1);
  const repaired = normalizeEditorDocument(doc);
  expect(deriveRooms(repaired).map((r) => Math.round(r.areaMm2 / 1e5) / 10).sort((a, b) => a - b)).toEqual([6, 24]);
  expect(normalizeEditorDocument(repaired)).toBe(repaired);
  const store = createEditorStore(doc);
  expect(deriveRooms(store.getState().document)).toHaveLength(2);
  expect(store.getState().sequence).toBe(0);
});

it('duplicar un objeto conserva sus propiedades con id nuevo y se inserta sin mover el original', async () => {
  const { duplicateSpatialItem, insertSpatialItem } = await import('@/canvas/editor-v2/spatial-clipboard');
  const { addFurniture } = await import('@/canvas/editor-v2/editing-operations');
  const { OUTDOOR_CATALOG } = await import('@/lib/editor-document/outdoor-catalog');
  const { planObjects } = await import('@/lib/editor-document/boundary-types');
  const doc = addFurniture(house(), OUTDOOR_CATALOG[0]!, { x: 1000, y: 6000 });
  const original = planObjects(doc).at(-1)!;
  const copy = { ...duplicateSpatialItem(original), x: 5000, y: 6000 };
  const next = createEditorStore(doc); next.getState().apply(insertSpatialItem(doc, copy));
  const objects = planObjects(next.getState().document);
  expect(objects).toHaveLength(2);
  expect(objects.find((o) => o.id === original.id)?.x).toBe(1000);
  expect(objects.find((o) => o.id === copy.id)).toMatchObject({ x: 5000, kind: original.kind, widthMm: original.widthMm });
});

it('añadir desde el catálogo deja el mueble pendiente de colocar y lo inserta donde se hace clic', async () => {
  const { addFurniture } = await import('@/canvas/editor-v2/editing-operations');
  const { FURNITURE_CATALOG } = await import('@/lib/editor-document/furniture-catalog');
  const { planObjects } = await import('@/lib/editor-document/boundary-types');
  const doc = house(), store = createEditorStore(doc);
  const bed = FURNITURE_CATALOG.find((e) => e.id === 'habiteka:furniture:cama-individual')!;
  const item = addFurniture(doc, bed, { x: 500, y: 500 }).furniture.at(-1)!;
  store.getState().beginPlaceSpatial(item);
  expect(store.getState().tool).toBe('place-object');
  expect(store.getState().pendingSpatial?.id).toBe(item.id);
  expect(planObjects(store.getState().document)).toHaveLength(0);
  // Dentro de la casa (8 × 3 m), sin tocar los muros.
  store.getState().placePendingSpatial({ ...item, x: 3000, y: 500 });
  expect(store.getState().error).toBeNull();
  expect(planObjects(store.getState().document).map((o) => [o.id, o.x, o.y])).toEqual([[item.id, 3000, 500]]);
  expect(store.getState().tool).toBe('select');
  expect(store.getState().selection).toEqual([item.id]);
});
