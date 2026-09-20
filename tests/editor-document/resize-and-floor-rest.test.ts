import { expect, it } from 'vitest';
import { resizeFromCorner } from '@/lib/editor-document/resize-from-corner';
import { restObjectsOnFloors } from '@/lib/editor-document/object-floor-rest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath, addFurniture } from '@/canvas/editor-v2/editing-operations';
import { FURNITURE_CATALOG } from '@/lib/editor-document/furniture-catalog';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { localToWorld } from '@/lib/editor-document/spatial-properties';

const item = { x: 1000, y: 2000, widthMm: 800, depthMm: 400, rotation: 0 };

it('arrastrar una esquina deja fija la opuesta', () => {
  // Esquina 2 (abajo-derecha) hacia fuera: crece solo por la derecha y por abajo.
  const grown = resizeFromCorner(item, 2, { x: 2000, y: 2600 });
  expect(grown).toMatchObject({ x: 1000, y: 2000, widthMm: 1000, depthMm: 600 });
  // Esquina 0 (arriba-izquierda) hacia dentro: la esquina opuesta (1800, 2400) no se mueve.
  const shrunk = resizeFromCorner(item, 0, { x: 1400, y: 2100 });
  expect(shrunk).toMatchObject({ x: 1400, y: 2100, widthMm: 400, depthMm: 300 });
  expect(localToWorld(shrunk, { x: shrunk.widthMm, y: shrunk.depthMm })).toEqual({ x: 1800, y: 2400 });
});

it('con Alt el redimensionado es simétrico alrededor del centro', () => {
  const grown = resizeFromCorner(item, 2, { x: 2000, y: 2600 }, true);
  expect(grown).toMatchObject({ widthMm: 1200, depthMm: 800, x: 800, y: 1800 });
});

it('respeta la rotación: la esquina opuesta permanece en el mismo punto del plano', () => {
  const rotated = { ...item, rotation: 30 };
  const opposite = localToWorld(rotated, { x: rotated.widthMm, y: rotated.depthMm });
  const resized = resizeFromCorner(rotated, 0, localToWorld(rotated, { x: 200, y: 100 }));
  expect(resized.widthMm).toBeCloseTo(600, 6); expect(resized.depthMm).toBeCloseTo(300, 6);
  const after = localToWorld(resized, { x: resized.widthMm, y: resized.depthMm });
  expect(after.x).toBeCloseTo(opposite.x, 6); expect(after.y).toBeCloseTo(opposite.y, 6);
});

it('los muebles de una estancia con suelo elevado se apoyan en ese suelo al cargar y al editar', () => {
  let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 5000 }, { x: 0, y: 5000 }], true);
  const bed = FURNITURE_CATALOG.find((e) => e.id === 'habiteka:furniture:cama-individual')!;
  doc = addFurniture(doc, bed, { x: 500, y: 500 });
  doc = setFloorFinish(doc, deriveRooms(doc)[0]!.id, { elevationMm: 1000 });
  // Cambiar la cota ya sube el mueble; un documento antiguo con el mueble enterrado se corrige al sanear.
  expect(doc.furniture[0]!.elevationMm).toBe(1000);
  const buried = { ...doc, furniture: [{ ...doc.furniture[0]!, elevationMm: 0 }] };
  const rested = restObjectsOnFloors(buried);
  expect(rested.furniture[0]!.elevationMm).toBe(1000);
  expect(restObjectsOnFloors(rested)).toBe(rested);
  // Un objeto colocado más alto a mano no baja.
  const raised = { ...rested, furniture: [{ ...rested.furniture[0]!, elevationMm: 1400 }] };
  expect(restObjectsOnFloors(raised)).toBe(raised);
  expect(createEditorStore(buried).getState().document.furniture[0]!.elevationMm).toBe(1000);
});

it('subir la cota del suelo sube muebles, columnas y aberturas y alarga los muros para conservar la altura libre', async () => {
  const { addColumn } = await import('@/lib/editor-document/construction-commands');
  const { wallConstruction } = await import('@/lib/editor-document/construction-properties');
  let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 5000 }, { x: 0, y: 5000 }], true);
  // Tabique interior compartido por dos estancias; al unirse en T parte los muros norte y sur.
  doc = addWallPath(doc, [{ x: 3000, y: 0 }, { x: 3000, y: 5000 }], false);
  const bed = FURNITURE_CATALOG.find((e) => e.id === 'habiteka:furniture:cama-individual')!;
  doc = addFurniture(doc, bed, { x: 800, y: 1500 });
  doc = { ...doc, furniture: doc.furniture.map((f) => ({ ...f, x: 300, y: 300 })) };
  doc = addColumn(doc, { id: 'col', catalogId: 'builtin:column-rectangular', x: 200, y: 4000, widthMm: 300, depthMm: 300, elevationMm: 0, heightMm: 2700, rotation: 0, materialId: 'concrete-grey' });
  const at = (id: string) => doc.vertices.find((v) => v.id === id)!;
  const south = doc.walls.find((w) => at(w.startVertexId).y === 5000 && at(w.endVertexId).y === 5000 && Math.max(at(w.startVertexId).x, at(w.endVertexId).x) <= 3000)!;
  const shared = doc.walls.find((w) => at(w.startVertexId).x === 3000 && at(w.endVertexId).x === 3000)!;
  const opening = (id: string, wallId: string, kind: string, elevationMm: number, heightMm: number) => ({ id, wallId, kind, position: .5, widthMm: 900, heightMm, elevationMm,
    catalogId: `builtin:${kind}`, hinge: 'left', swing: 'left', openAngleDeg: 0, dimensionalOrigin: 'physical', colors: { frame: '#ffffff', leaf: '#ffffff' } } as (typeof doc.openings)[number]);
  doc = { ...doc, openings: [opening('door', south.id, 'puerta', 0, 2100), opening('win', shared.id, 'ventana', 900, 1200)] };
  const rooms = deriveRooms(doc), left = rooms.find((r) => r.boundary.every((p) => p.x <= 3000))!;
  const wallHeightBefore = wallConstruction(south).heightMm;
  const raised = setFloorFinish(doc, left.id, { elevationMm: 1000 });
  expect(raised.furniture[0]!.elevationMm).toBe(1000);
  expect(raised.columns![0]!.elevationMm).toBe(1000);
  expect(raised.openings.find((o) => o.id === 'door')!.elevationMm).toBe(1000);
  expect(raised.openings.find((o) => o.id === 'win')!.elevationMm).toBe(1900);
  expect(wallConstruction(raised.walls.find((w) => w.id === south.id)!).heightMm).toBe(wallHeightBefore + 1000);
  // La estancia derecha sube después al mismo nivel: el tabique compartido no crece dos veces.
  const right = deriveRooms(raised).find((r) => r.id !== left.id)!;
  const both = setFloorFinish(raised, right.id, { elevationMm: 1000 });
  expect(wallConstruction(both.walls.find((w) => w.id === shared.id)!).heightMm).toBe(wallConstruction(raised.walls.find((w) => w.id === shared.id)!).heightMm);
  expect(both.openings.find((o) => o.id === 'win')!.elevationMm).toBe(1900);
});
