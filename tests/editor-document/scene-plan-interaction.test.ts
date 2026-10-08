import { expect, it } from 'vitest';
import { emptyEditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { insertSpatialItem } from '@/canvas/editor-v2/spatial-clipboard';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { planDragPosition, positionedPending } from '@/components/editor-v2/scene/scene-plan-interaction';
import { addTerrainSurface, suggestedTerrainSurface } from '@/lib/editor-document/terrain-surfaces';

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

it('mueve el terreno libremente cuando no tiene referencias cercanas', () => {
  const store = createEditorStore(emptyEditorDocument());
  const surface = suggestedTerrainSurface(store.getState().document, 'terreno');
  const drag = { id: surface.id, item: surface, terrain: true, start: { x: 1000, y: 1000 }, pointerId: 1 };
  expect(planDragPosition(drag, { x: 1237, y: 1153 }, store)).toMatchObject({
    x: surface.x + 237, y: surface.y + 153,
  });
});

it('el pavimento visual se alinea con otra superficie a cualquier zoom y admite ajuste desactivado', () => {
  const initial = emptyEditorDocument();
  const surface = { ...suggestedTerrainSurface(initial, 'pavimento'), x: 0, y: 0, widthMm: 4000, depthMm: 3000 };
  const other = { ...surface, id: 'terreno', x: 8000, y: 9000 };
  const store = createEditorStore(addTerrainSurface(addTerrainSurface(initial, surface), other));
  const drag = { id: surface.id, item: surface, terrain: true, start: { x: 1000, y: 1000 }, pointerId: 1 };
  for (const scale of [.02, .1, .5]) {
    expect(planDragPosition(drag, { x: 5000 - 9 / scale, y: 1000 }, store, scale).x).toBe(4000);
    expect(store.getState().magneticGuides.length).toBeGreaterThan(0);
  }
  store.getState().setSnap(false);
  expect(planDragPosition(drag, { x: 4950, y: 1000 }, store, .1).x).toBe(3950);
  expect(store.getState().magneticGuides).toEqual([]);
  expect(store.getState().document.terrainSurfaces?.[0]?.x).toBe(0);
});
