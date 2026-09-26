import { expect, it } from 'vitest';
import { emptyEditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { insertSpatialItem } from '@/canvas/editor-v2/spatial-clipboard';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { planDragPosition, positionedPending } from '@/components/editor-v2/scene/scene-plan-interaction';

const table: Furniture = { id: 'mesa', kind: 'mesa-comedor', catalogId: 'habiteka:furniture:mesa-comedor',
  x: 1000, y: 1000, widthMm: 1600, depthMm: 900, heightMm: 750, elevationMm: 0, rotation: 0,
  color: '#b89364', dimensionalOrigin: 'physical' };

it('el plano visual usa la misma posición fina en vista previa y al soltar, sin el imán técnico', () => {
  const store = createEditorStore(insertSpatialItem(emptyEditorDocument(), table));
  const drag = { id: table.id, item: table, start: { x: 1100, y: 1100 }, pointerId: 1 };
  const point = { x: 1237, y: 1153 };
  const preview = planDragPosition(drag, point, store);
  expect(preview.x).toBe(1140); expect(preview.y).toBe(1050);
  const pending = positionedPending(table, { x: 1140 + table.widthMm / 2, y: 1050 + table.depthMm / 2 }, store);
  expect(pending.x).toBe(preview.x); expect(pending.y).toBe(preview.y);
  store.getState().setSnap(false);
  expect(planDragPosition(drag, point, store)).toMatchObject({ x: 1137, y: 1053 });
});
