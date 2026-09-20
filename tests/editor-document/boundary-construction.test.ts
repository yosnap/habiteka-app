import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addLinearBoundary } from '@/lib/editor-document/linear-boundary';
import { addBoundaryGate, putBoundaryGate, splitBoundary, updateBoundary, upgradeBoundaryDocument } from '@/lib/editor-document/boundary-commands';
import { boundaryVolumes } from '@/lib/editor-document/boundary-volumes';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { duplicateSpatialItem, insertSpatialItem } from '@/canvas/editor-v2/spatial-clipboard';
import { nudgeElements } from '@/canvas/editor-v2/nudge-elements';
import { boundaryDesignContext } from '@/lib/editor-document/boundary-context';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { walkthroughNavigation } from '@/lib/editor-document/walkthrough-navigation';

function mixed() {
  let doc = addLinearBoundary(emptyEditorDocument(), 'valla-madera', { x: 0, y: 0 }, { x: 6000, y: 0 });
  const b = doc.boundaries![0]!;
  doc = updateBoundary(doc, b.id, { heightMm: 2000, depthMm: 200, construction: { ...b.construction, baseHeightMm: 1000, infill: 'horizontal', postShape: 'circle', postSizeMm: 150 } });
  return doc;
}
it('conserva IDs, comentarios y dimensiones al migrar muebles antiguos', () => {
  const doc = mixed(), b = doc.boundaries![0]!;
  const old = { id: b.id, kind: b.kind, catalogId: b.catalogId, x: b.x, y: b.y, widthMm: b.widthMm, depthMm: b.depthMm, heightMm: b.heightMm, elevationMm: b.elevationMm, color: b.color, rotation: b.rotation, dimensionalOrigin: b.dimensionalOrigin };
  const legacy = { ...doc, furniture: [old], boundaries: [] };
  legacy.comments!.push({ id: 'comment', targetEntityId: b.id, anchor: { x: .5, y: .5 }, text: 'Conservar' });
  const migrated = upgradeBoundaryDocument(legacy);
  expect(migrated.furniture).toEqual([]); expect(migrated.boundaries![0]!.id).toBe(b.id);
  expect(migrated.comments).toEqual(legacy.comments); expect(migrated.boundaries![0]!.widthMm).toBe(6000);
  expect(legacy.furniture).toHaveLength(1);
});
it('recorta muro y lamas con hueco real y genera columnas circulares en escena', () => {
  const source = mixed(), doc = addBoundaryGate(source, source.boundaries![0]!.id), b = doc.boundaries![0]!;
  const volumes = boundaryVolumes(b), gate = b.construction.gates[0]!;
  expect(volumes.some((p) => p.shape === 'cylinder')).toBe(true);
  expect(volumes.filter((p) => p.part !== 'gate').some((p) => p.x < gate.positionMm && p.x + p.widthMm > gate.positionMm && p.bottom < gate.heightMm)).toBe(false);
  const scene = editorDocumentToScene(doc);
  expect(scene.boxes.some((p) => p.shape === 'cylinder')).toBe(true);
  expect(scene.boxes.some((p) => p.boundaryPart === 'gate')).toBe(true);
  expect(parseEditorDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
});
it('puertas sobreviven a giro, movimiento y copia sin IDs repetidos', () => {
  let doc = mixed(); const id = doc.boundaries![0]!.id; doc = addBoundaryGate(doc, id);
  doc = updateBoundary(doc, id, { rotation: 90 }); doc = nudgeElements(doc, [id], { x: 10, y: 20 });
  const b = doc.boundaries![0]!, copy = duplicateSpatialItem(b);
  const copied = insertSpatialItem(doc, copy);
  expect(copied.boundaries).toHaveLength(2);
  expect(copied.boundaries![1]!.construction.gates[0]!.id).not.toBe(b.construction.gates[0]!.id);
  expect(b.construction.gates[0]!.positionMm).toBe(3000);
  expect(boundaryDesignContext(doc)[0]!.gates).toHaveLength(1);
});
it('rechaza huecos superpuestos, fuera del tramo y división que atraviesa puerta', () => {
  let doc = mixed(); const id = doc.boundaries![0]!.id; doc = addBoundaryGate(doc, id);
  expect(() => addBoundaryGate(doc, id)).toThrow(/solapan/);
  expect(() => addBoundaryGate(doc, id, 0)).toThrow(/postes/);
  expect(() => splitBoundary(doc, id, 3000)).toThrow(/puerta/);
  expect(() => updateBoundary(doc, id, { widthMm: 2000 })).toThrow();
  const split = splitBoundary(doc, id, 1500);
  expect(split.boundaries).toHaveLength(2);
  expect(split.boundaries![1]!.construction.gates[0]!.positionMm).toBe(1500);
});
it('deshacer y rehacer restaura composición y puertas de forma atómica', () => {
  const source = mixed(), store = createEditorStore(source);
  store.getState().apply(addBoundaryGate(source, source.boundaries![0]!.id));
  store.getState().undo(); expect(store.getState().document).toEqual(source);
  store.getState().redo(); expect(store.getState().document.boundaries![0]!.construction.gates).toHaveLength(1);
});
it('una puerta abierta permite paso y cerrada lo bloquea', () => {
  let doc = addOutdoorArea(emptyEditorDocument(), { x: -2000, y: -3000 }, { x: 8000, y: 3000 });
  doc = addLinearBoundary(doc, 'cerca-metal', { x: -2000, y: 0 }, { x: 8000, y: 0 });
  const b = doc.boundaries![0]!;
  doc = updateBoundary(doc, b.id, { heightMm: 2200 }); doc = addBoundaryGate(doc, b.id);
  const gate = doc.boundaries![0]!.construction.gates[0]!;
  expect(walkthroughNavigation(doc).segmentFree({ x: 3000, y: -1000 }, { x: 3000, y: 1000 })).toBe(false);
  doc = putBoundaryGate(doc, b.id, { ...gate, openAngleDeg: 90 });
  expect(walkthroughNavigation(doc).segmentFree({ x: 3000, y: -1000 }, { x: 3000, y: 1000 })).toBe(true);
});
it('las flechas desplazan una puerta por su tramo sin desplazar el cerramiento', () => {
  let doc = mixed(); const id = doc.boundaries![0]!.id; doc = addBoundaryGate(doc, id);
  const b = doc.boundaries![0]!, gate = b.construction.gates[0]!;
  const shifted = nudgeElements(doc, [gate.id], { x: 10, y: 0 }).boundaries![0]!;
  expect(shifted.x).toBe(b.x); expect(shifted.construction.gates[0]!.positionMm).toBe(gate.positionMm + 10);
});
it('los postes idénticos compartidos se dibujan una sola vez', () => {
  let doc = addLinearBoundary(emptyEditorDocument(), 'valla-madera', { x: 0, y: 0 }, { x: 4000, y: 0 });
  doc = addLinearBoundary(doc, 'valla-madera', { x: 4000, y: 0 }, { x: 4000, y: 4000 });
  const posts = editorDocumentToScene(doc).boxes.filter((b) => b.boundaryPart === 'post');
  expect(posts).toHaveLength(5);
  expect(posts.filter((b) => Math.abs(b.position[0] - 4) < .0001 && Math.abs(b.position[2]) < .0001)).toHaveLength(1);
});
it('materiales del muro, valla y postes son independientes y no se filtran entre partes', () => {
  let doc = mixed(); const b = doc.boundaries![0]!;
  doc = updateBoundary(doc, b.id, { construction: { ...b.construction, infillMaterialId: 'polyhaven:oak_wood_planks' } });
  const volumes = boundaryVolumes(doc.boundaries![0]!);
  expect(volumes.find((v) => v.top === 1000 && v.part !== 'post')?.materialId).toBeUndefined();
  expect(volumes.some((v) => v.materialId === 'polyhaven:oak_wood_planks')).toBe(true);
});
