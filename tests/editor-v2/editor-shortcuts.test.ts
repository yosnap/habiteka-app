import { expect, it } from 'vitest';
import { EDITOR_SHORTCUTS, plainShortcutFor, shortcutHint, type EditorShortcutId } from '@/canvas/editor-v2/editor-shortcuts';
import { fittedView, zoomedView, DEFAULT_VIEW } from '@/canvas/editor-v2/view-math';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { createEditorStore } from '@/canvas/editor-v2/store';

it('ningún atajo sin modificador se repite entre herramientas y navegación', () => {
  const plain = (Object.keys(EDITOR_SHORTCUTS) as EditorShortcutId[]).filter((id) => !['undo', 'redo', 'copy', 'paste', 'selectAll'].includes(id));
  const keys = plain.flatMap((id) => EDITOR_SHORTCUTS[id].keys);
  expect(new Set(keys).size).toBe(keys.length);
  expect(plainShortcutFor(' ')).toBe('pan');
  expect(plainShortcutFor('0')).toBe('fit');
  expect(plainShortcutFor('C')).toBe('construct');
  expect(plainShortcutFor('=')).toBe('zoomIn');
  expect(shortcutHint('Mano', 'pan')).toBe('Mano · Espacio');
});

it('encuadre y zoom son funciones puras de la vista', () => {
  const size = { width: 800, height: 600 };
  expect(fittedView(emptyEditorDocument(), size)).toEqual(DEFAULT_VIEW);
  const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 4000 }, { x: 0, y: 4000 }], true);
  const fitted = fittedView(doc, size);
  // El plano de 8 × 4 m cabe entero con margen y queda centrado.
  expect(fitted.scale * 8000).toBeLessThanOrEqual(size.width - 160);
  expect(fitted.x + 4000 * fitted.scale).toBeCloseTo(size.width / 2, 0);
  const zoomed = zoomedView(fitted, 1.25, size);
  expect(zoomed.scale).toBeCloseTo(fitted.scale * 1.25, 6);
  // El centro de pantalla se mantiene fijo al hacer zoom desde el centro.
  expect((size.width / 2 - zoomed.x) / zoomed.scale).toBeCloseTo((size.width / 2 - fitted.x) / fitted.scale, 3);
});

it('el store guarda el modo mano y numera las peticiones de vista', () => {
  const store = createEditorStore(emptyEditorDocument());
  expect(store.getState().pan).toBe(false);
  store.getState().setPan(true); expect(store.getState().pan).toBe(true);
  store.getState().requestView('fit'); store.getState().requestView('fit');
  expect(store.getState().viewRequest).toEqual({ kind: 'fit', nonce: 2 });
});
