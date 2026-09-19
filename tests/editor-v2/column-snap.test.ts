import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addRamp, addStair, addColumn } from '@/lib/editor-document/construction-commands';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { snapObject } from '@/canvas/editor-v2/spatial-placement';
import { clickSelect } from '@/canvas/editor-v2/selection-click';

const column = { id: 'c', catalogId: 'builtin:column-rectangular' as const, x: 0, y: 0, widthMm: 400, depthMm: 400, elevationMm: 0, heightMm: 2700, rotation: 0, materialId: 'concrete-grey' };

it('el centro de una columna se imanta a la esquina del descansillo y queda medio fuera', () => {
  const doc = addRamp(emptyEditorDocument(), { id: 'landing', catalogId: 'builtin:ramp-landing', x: 0, y: 0, widthMm: 2000, depthMm: 2000, elevationMm: 1000, riseMm: 0, rotation: 0, materialId: 'concrete-grey' });
  const snapped = snapObject(doc, { ...column, x: 1830, y: 1770 }, .1, true);
  expect({ x: snapped.x, y: snapped.y }).toEqual({ x: 1800, y: 1800 });
  expect(() => createEditorStore(doc).getState().apply(addColumn(doc, { ...column, x: snapped.x, y: snapped.y }))).not.toThrow();
});

it('una columna se centra en el borde entre descansillo y escalera', () => {
  let doc = addRamp(emptyEditorDocument(), { id: 'landing', catalogId: 'builtin:ramp-landing', x: 0, y: 0, widthMm: 2000, depthMm: 2000, elevationMm: 1000, riseMm: 0, rotation: 0, materialId: 'concrete-grey' });
  doc = addStair(doc, { id: 's', kind: 'straight', catalogId: 'stair-straight', x: 2000, y: 400, widthMm: 1000, depthMm: 1200, heightMm: 1000, elevationMm: 0, rotation: 90, stepCount: 6, materialId: 'wood-oak' });
  const snapped = snapObject(doc, { ...column, x: 1770, y: 640 }, .1, true);
  expect(snapped.x).toBe(1800);
  expect(() => createEditorStore(doc).getState().apply(addColumn(doc, { ...column, x: snapped.x, y: snapped.y }))).not.toThrow();
});

it('Mayús, ⌘ o Ctrl + clic añaden y quitan de la selección en cualquier capa', () => {
  const store = createEditorStore(emptyEditorDocument());
  clickSelect(store, 'a', { shiftKey: false });
  clickSelect(store, 'b', { shiftKey: true });
  clickSelect(store, 'c', { metaKey: true });
  expect(store.getState().selection).toEqual(['a', 'b', 'c']);
  clickSelect(store, 'b', { ctrlKey: true });
  expect(store.getState().selection).toEqual(['a', 'c']);
  clickSelect(store, 'd', undefined);
  expect(store.getState().selection).toEqual(['d']);
});
