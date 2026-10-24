import { expect, it } from 'vitest';
import { emptyEditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { insertSpatialItem } from '@/canvas/editor-v2/spatial-clipboard';
import { furnitureDragConstraint } from '@/canvas/editor-v2/constrained-furniture-drag';
import { assertSpatialPlacement } from '@/canvas/editor-v2/spatial-placement';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';

const box: Furniture = { id: 'box', kind: 'armario', x: 0, y: 1000, widthMm: 600, depthMm: 600, heightMm: 1800, elevationMm: 0, rotation: 0, color: '#ffffff', dimensionalOrigin: 'physical' };
function fixture() {
  const doc = addWallPath(emptyEditorDocument(), [{ x: 2000, y: 0 }, { x: 2000, y: 4000 }]);
  return insertSpatialItem(doc, box);
}
it('frena antes del muro aunque el destino esté totalmente al otro lado', () => {
  const doc = fixture(), before = JSON.stringify(doc);
  const next = furnitureDragConstraint(doc, box.id)(box, { ...box, x: 5000 });
  expect(next.x).toBeGreaterThan(1200); expect(next.x).toBeLessThan(1402);
  expect(() => assertSpatialPlacement(doc, updateFurniture(doc, box.id, { x: next.x, y: next.y }))).not.toThrow();
  expect(JSON.stringify(doc)).toBe(before);
});
it('mantiene el límite en eventos sucesivos y deja retirarse del muro', () => {
  const doc = fixture(), limit = furnitureDragConstraint(doc, box.id);
  const first = limit(box, { ...box, x: 5000 });
  const second = limit(first, { ...box, x: 6000 });
  expect(second.x).toBeCloseTo(first.x, 0);
  expect(limit(second, { ...box, x: 500 }).x).toBe(500);
});
it('frena ante otro mueble, sin convertir un salto de puntero en un cruce', () => {
  const doc = insertSpatialItem(insertSpatialItem(emptyEditorDocument(), box), { ...box, id: 'obstacle', x: 2000 });
  const next = furnitureDragConstraint(doc, box.id)(box, { ...box, x: 5000 });
  expect(next.x).toBeLessThan(1402);
  expect(next.x).toBeGreaterThan(1390);
});
it('no bloquea un movimiento libre ni un objeto por encima de un obstáculo bajo', () => {
  const raised = { ...box, elevationMm: 1000 };
  const doc = insertSpatialItem(insertSpatialItem(emptyEditorDocument(), raised), { ...box, id: 'low', x: 2000, heightMm: 500 });
  expect(furnitureDragConstraint(doc, box.id)(raised, { ...raised, x: 5000 }).x).toBe(5000);
});
