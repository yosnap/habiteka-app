import { expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';
import type { KitchenRun } from '@/lib/editor-document/kitchen-run-types';
import { addWallPath, deleteEntities } from '@/canvas/editor-v2/editing-operations';
import { addKitchenRun, addKitchenSlot, putKitchenSlot, splitKitchenRun, updateKitchenRun, upgradeKitchenDocument } from '@/lib/editor-document/kitchen-run-commands';
import { kitchenRunVolumes, isKitchenJoint, moduleSpans } from '@/lib/editor-document/kitchen-run-volumes';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { duplicateSpatialItem, insertSpatialItem } from '@/canvas/editor-v2/spatial-clipboard';
import { nudgeElements } from '@/canvas/editor-v2/nudge-elements';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { normalizeEditorDocument } from '@/lib/editor-document/document-normalization';
import { addColumn } from '@/lib/editor-document/construction-commands';
import { planElementIndex } from '@/lib/editor-document/plan-element-index';
import { idsByKind } from '@/canvas/editor-v2/select-by-kind';
import { bulkPeers, propagateToPeers } from '@/lib/editor-document/bulk-edit';
import { paintElement, updateFurniture } from '@/lib/editor-document/spatial-commands';
import { upgradeBoundaryDocument } from '@/lib/editor-document/boundary-commands';
import { addLinearBoundary } from '@/lib/editor-document/linear-boundary';

// Estancia de 8 × 4 m; `t` es el grosor de muro, así que la cara interior del muro norte está en y = t/2.
const house = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 4000 }, { x: 0, y: 4000 }], true);
const face = (doc: EditorDocument) => doc.walls[0]!.thicknessMm / 2;
// El cuerpo queda a la izquierda del sentido de trazado: por el muro norte se traza hacia +x y el mueble cae hacia +y (dentro).
const northRun = (doc: EditorDocument, lengthMm = 3000) => addKitchenRun(doc, { x: face(doc), y: face(doc) }, { x: face(doc) + lengthMm, y: face(doc) });
const run = (doc: EditorDocument, index = 0) => doc.kitchenRuns![index]!;

it('se traza por la línea trasera como una pared, persiste y se deshace de una pieza', () => {
  const source = house(), doc = northRun(source), item = run(doc);
  expect(doc.schemaVersion).toBe(11);
  expect(item.widthMm).toBe(3000); expect(item.depthMm).toBe(600); expect(item.heightMm).toBe(900);
  expect(localToWorld(item, { x: 0, y: 0 })).toEqual({ x: face(doc), y: face(doc) });
  const end = localToWorld(item, { x: item.widthMm, y: 0 });
  expect(end.x).toBeCloseTo(face(doc) + 3000); expect(end.y).toBeCloseTo(face(doc));
  expect(parseEditorDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  const store = createEditorStore(source);
  store.getState().apply(doc); store.getState().undo();
  expect(store.getState().document).toEqual(source);
  store.getState().redo(); expect(store.getState().document.kitchenRuns).toHaveLength(1);
  expect(() => addKitchenRun(source, { x: 0, y: 0 }, { x: 200, y: 0 })).toThrow(/30 cm/);
});

it('la geometría queda dentro de la huella: zócalo retranqueado, un frente y tirador por módulo y encimera a 90 cm', () => {
  const item = run(northRun(house())), volumes = kitchenRunVolumes(item);
  for (const v of volumes) {
    expect(v.x).toBeGreaterThanOrEqual(-.01); expect(v.x + v.widthMm).toBeLessThanOrEqual(item.widthMm + .01);
    expect(v.y).toBeGreaterThanOrEqual(-.01); expect(v.y + v.depthMm).toBeLessThanOrEqual(item.depthMm + .01);
  }
  expect(Math.max(...volumes.map((v) => v.top))).toBe(900);
  const worktop = volumes.find((v) => v.top === 900 && v.widthMm === 3000)!;
  expect(worktop.bottom).toBe(870); expect(worktop.color).toBe(item.kitchen.worktopColor);
  const plinth = volumes.find((v) => v.bottom === 0)!;
  expect(plinth.depthMm).toBeLessThan(item.depthMm);
  expect(volumes.filter((v) => v.color === '#434743')).toHaveLength(5);
  expect(moduleSpans({ from: 0, to: 2500 }, 600).map((m) => m.to - m.from)).toEqual([600, 600, 600, 700]);
});

it('los aparatos recortan lo que les toca: horno y lavavajillas la base, el frigorífico también encimera y altos', () => {
  let doc = northRun(house(), 4000); const id = run(doc).id;
  doc = updateKitchenRun(doc, id, { kitchen: { ...run(doc).kitchen, uppers: { bottomMm: 1450, heightMm: 700, depthMm: 350, color: '#f1eee6' } } });
  doc = addKitchenSlot(doc, id, 'horno', 900); doc = addKitchenSlot(doc, id, 'fregadero', 2000); doc = addKitchenSlot(doc, id, 'frigorifico-columna', 3600);
  const item = run(doc), volumes = kitchenRunVolumes(item);
  const across = (x: number, bottom: number, top: number) => volumes.filter((v) => v.part !== 'slot' && v.x < x && v.x + v.widthMm > x && v.bottom < top && v.top > bottom);
  // Bajo el horno no queda carcasa ni frente propio del mueble, pero la encimera y los altos siguen.
  expect(across(900, 100, 870)).toHaveLength(0);
  expect(across(900, 870, 900)).toHaveLength(1);
  expect(across(900, 1450, 2150).length).toBeGreaterThan(0);
  // El fregadero no recorta: el módulo permanece y aporta cubeta y grifo.
  expect(across(2000, 100, 870).length).toBeGreaterThan(0);
  expect(volumes.some((v) => v.part === 'slot' && v.shape === 'cylinder')).toBe(true);
  // El frigorífico columna lo atraviesa todo hasta la coronación de los altos.
  expect(across(3600, 0, 2150)).toHaveLength(0);
  const fridge = volumes.find((v) => v.part === 'slot' && v.top === 2150)!;
  expect(fridge.bottom).toBe(0);
  expect(volumes.every((v) => v.top <= 2150)).toBe(true);
  const scene = editorDocumentToScene(doc);
  expect(scene.boxes.filter((b) => b.boundaryPart === 'slot').map((b) => b.sourceEntityId)).toContain(item.kitchen.slots[0]!.id);
  expect(parseEditorDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
});

it('rechaza aparatos solapados o fuera del tramo, altos bajo la encimera y divisiones que cortan un aparato', () => {
  let doc = northRun(house()); const id = run(doc).id;
  doc = addKitchenSlot(doc, id, 'lavavajillas');
  expect(() => addKitchenSlot(doc, id, 'horno', 1600)).toThrow(/solapan/);
  expect(() => addKitchenSlot(doc, id, 'horno', 100)).toThrow(/sobresale/);
  expect(() => updateKitchenRun(doc, id, { kitchen: { ...run(doc).kitchen, uppers: { bottomMm: 950, heightMm: 700, depthMm: 350, color: '#ffffff' } } })).toThrow();
  expect(() => updateKitchenRun(doc, id, { widthMm: 1000 })).toThrow();
  expect(() => splitKitchenRun(doc, id, 1500)).toThrow(/aparato/);
  const split = splitKitchenRun(doc, id, 2400);
  expect(split.kitchenRuns).toHaveLength(2);
  expect(run(split, 0).kitchen.slots).toHaveLength(1); expect(run(split, 1).kitchen.slots).toHaveLength(0);
  const tail = localToWorld(run(split, 1), { x: 0, y: 0 });
  expect(tail.x).toBeCloseTo(face(doc) + 2400);
});

it('un tramo pegado a la cara del muro no colisiona; dentro del muro o sobre otro tramo sí; un pilar encima es recorte', () => {
  const source = house(), store = createEditorStore(source), f = face(source);
  expect(() => store.getState().apply(northRun(store.getState().document))).not.toThrow();
  const current = store.getState().document;
  expect(() => store.getState().apply(addKitchenRun(current, { x: f + 4000, y: 0 }, { x: f + 7000, y: 0 }))).toThrow(/atraviesa/);
  expect(() => store.getState().apply(addKitchenRun(current, { x: f + 1000, y: f + 200 }, { x: f + 2500, y: f + 200 }))).toThrow(/atraviesa/);
  expect(() => store.getState().apply(addColumn(current, { id: 'pilar', catalogId: 'builtin:column-rectangular', x: f + 1000, y: f, widthMm: 300, depthMm: 300,
    heightMm: 2700, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' }))).not.toThrow();
});

it('dos tramos en L comparten la esquina: sin colisión y el de id menor conserva el módulo de esquina', () => {
  const source = house(), store = createEditorStore(source), f = face(source);
  store.getState().apply(northRun(store.getState().document));
  // Por el muro oeste se traza hacia −y para que el cuerpo caiga hacia +x (dentro de la estancia).
  expect(() => store.getState().apply(addKitchenRun(store.getState().document, { x: f, y: f + 2500 }, { x: f, y: f }))).not.toThrow();
  const doc = store.getState().document, [a, b] = doc.kitchenRuns!;
  expect(isKitchenJoint(a!, b!)).toBe(true);
  const owner = a!.id < b!.id ? a! : b!, other = owner === a ? b! : a!;
  expect(furnitureVolumes(owner, doc)).toEqual(kitchenRunVolumes(owner));
  const trimmed = furnitureVolumes(other, doc), cornerX = other === b ? other.widthMm - 600 : 600;
  expect(trimmed.length).toBeGreaterThan(0);
  for (const v of trimmed) if (other === b) expect(v.x + v.widthMm).toBeLessThanOrEqual(cornerX + .01); else expect(v.x).toBeGreaterThanOrEqual(cornerX - .01);
  // En 3D ninguna encimera se pisa con la otra en la esquina.
  const worktops = editorDocumentToScene(doc).boxes.filter((box) => box.role === 'furniture' && Math.abs(box.position[1] - .885) < .001);
  expect(worktops).toHaveLength(2);
});

it('se apoya en el suelo de su estancia al trazar y el saneamiento lo levanta si quedó enterrado', () => {
  let doc = house(); const room = deriveRooms(doc)[0]!;
  doc = setFloorFinish(doc, room.id, { elevationMm: 600 });
  doc = northRun(doc);
  expect(run(doc).elevationMm).toBe(600);
  expect(kitchenRunVolumes(run(doc)).find((v) => v.top === 1500)?.bottom).toBe(1470);
  const buried = { ...doc, kitchenRuns: [{ ...run(doc), elevationMm: 0 }] };
  expect(run(normalizeEditorDocument(buried)).elevationMm).toBe(600);
});

it('copiar, pegar, borrar aparatos y desplazarlos con flechas respetan la entidad', () => {
  let doc = northRun(house()); const id = run(doc).id;
  doc = addKitchenSlot(doc, id, 'vitroceramica');
  const copy = duplicateSpatialItem(run(doc));
  expect((copy as KitchenRun).kitchen.slots[0]!.id).not.toBe(run(doc).kitchen.slots[0]!.id);
  const pasted = insertSpatialItem(doc, { ...copy, y: copy.y + 2000 });
  expect(pasted.kitchenRuns).toHaveLength(2);
  const slot = run(doc).kitchen.slots[0]!;
  const shifted = nudgeElements(doc, [slot.id], { x: 250, y: 0 });
  expect(run(shifted).x).toBe(run(doc).x); expect(run(shifted).kitchen.slots[0]!.positionMm).toBe(slot.positionMm + 250);
  expect(run(deleteEntities(doc, [slot.id])).kitchen.slots).toHaveLength(0);
  expect(deleteEntities(doc, [id]).kitchenRuns).toHaveLength(0);
});

it('buscador, selección por tipo, edición en bloque y pintura tratan la cocina como objeto de plano', () => {
  let doc = northRun(house()); const a = run(doc).id;
  doc = addKitchenSlot(doc, a, 'horno');
  doc = addKitchenRun(doc, { x: face(doc) + 4000, y: face(doc) }, { x: face(doc) + 7000, y: face(doc) });
  const b = run(doc, 1).id, index = planElementIndex(doc, deriveRooms(doc));
  expect(index.filter((e) => e.label === 'Cocina lineal')).toHaveLength(2);
  expect(index.some((e) => e.label === 'Horno · Cocina lineal')).toBe(true);
  expect(idsByKind(doc, deriveRooms(doc), 'kitchens')).toEqual([a, b]);
  expect(idsByKind(doc, deriveRooms(doc), 'furniture')).toEqual([]);
  expect(bulkPeers(doc, a, [a, b])).toEqual([b]);
  const after = updateKitchenRun(doc, a, { kitchen: { ...run(doc).kitchen, worktopColor: '#123456' } });
  const propagated = propagateToPeers(doc, after, a, [b]);
  expect(run(propagated, 1).kitchen.worktopColor).toBe('#123456');
  expect(run(propagated, 0).kitchen.slots).toHaveLength(1); expect(run(propagated, 1).kitchen.slots).toHaveLength(0);
  expect(run(updateFurniture(doc, a, { color: '#abcdef' })).color).toBe('#abcdef');
  expect(run(paintElement(doc, a, 'worktop', '#fedcba')).kitchen.worktopColor).toBe('#fedcba');
});

it('leer un plano antiguo no lo cambia y las migraciones no degradan un esquema más nuevo', () => {
  const fence = addLinearBoundary(emptyEditorDocument(), 'valla-madera', { x: 0, y: 0 }, { x: 4000, y: 0 });
  expect(fence.schemaVersion).toBe(10);
  expect(parseEditorDocument(fence).schemaVersion).toBe(10);
  const upgraded = upgradeKitchenDocument(fence);
  expect(upgraded.schemaVersion).toBe(11); expect(upgraded.kitchenRuns).toEqual([]); expect(upgraded.boundaries).toHaveLength(1);
  const withRun = addKitchenRun(upgraded, { x: 0, y: 2000 }, { x: 3000, y: 2000 });
  const revisited = upgradeBoundaryDocument(withRun);
  expect(revisited.schemaVersion).toBe(11); expect(revisited.kitchenRuns).toHaveLength(1);
  expect(() => putKitchenSlot(withRun, run(withRun).id, { id: 'x', kind: 'horno', positionMm: 1500, widthMm: 600, color: 'rojo' })).toThrow(/Color/);
});

it('añadir aparatos sin indicar posición ocupa el primer hueco libre y avisa cuando el tramo está lleno', () => {
  let doc = northRun(house(), 2000); const id = run(doc).id;
  doc = addKitchenSlot(doc, id, 'fregadero'); doc = addKitchenSlot(doc, id, 'lavadora'); doc = addKitchenSlot(doc, id, 'horno');
  const slots = run(doc).kitchen.slots.map((s) => s.kind);
  expect(slots).toEqual(['fregadero', 'lavadora', 'horno']);
  expect(() => addKitchenSlot(doc, id, 'lavavajillas')).toThrow(/hueco libre/);
  // La lavadora vacía la base bajo su hueco y deja la encimera.
  const washer = run(doc).kitchen.slots[1]!, volumes = kitchenRunVolumes(run(doc));
  expect(volumes.some((v) => v.part !== 'slot' && v.x < washer.positionMm && v.x + v.widthMm > washer.positionMm && v.bottom < 800 && v.top > 200)).toBe(false);
  expect(volumes.some((v) => v.part !== 'slot' && v.x < washer.positionMm && v.x + v.widthMm > washer.positionMm && v.top === 900)).toBe(true);
});
