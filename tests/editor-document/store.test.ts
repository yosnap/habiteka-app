import { expect, it } from 'vitest';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { placeOpening, resolveOpeningPlacement } from '@/canvas/editor-v2/opening-placement';
import { addColumn } from '@/lib/editor-document/construction-commands';

it('copiar una abertura inicia colocación sin modificar documento ni historia', () => {
  const base = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }]);
  const source = { id: 'door', wallId: base.walls[0]!.id, position: .25,
    kind: 'puerta' as const, widthMm: 900, dimensionalOrigin: 'physical' as const };
  const store = createEditorStore(placeOpening(base, source, source));
  const before = store.getState().document;
  store.getState().copyOpening('door');
  const pending = store.getState().pendingOpening!;
  expect(pending.id).not.toBe(source.id);
  expect(pending.widthMm).toBe(900);
  expect(store.getState().document).toBe(before);
  expect(store.getState().past).toHaveLength(0);
  const placement = resolveOpeningPlacement(before, { x: 4500, y: 0 }, .1, pending)!;
  store.getState().apply(placeOpening(before, pending, placement));
  store.getState().setTool('select');
  expect(store.getState().pendingOpening).toBeNull();
  expect(store.getState().document.openings).toHaveLength(2);
  store.getState().undo(); expect(store.getState().document).toEqual(before);
  store.setState({ readOnly: true }); store.getState().copyOpening('door');
  expect(store.getState().pendingOpening).toBeNull();
});

it('bloquea undo y redo si la sesión pasa a solo lectura con historia existente', () => {
  const store = createEditorStore(emptyEditorDocument());
  store.getState().apply({ ...emptyEditorDocument(), labels: [{ id: 'a', text: 'A', x: 0, y: 0 }] });
  store.getState().apply({ ...emptyEditorDocument(), labels: [{ id: 'a', text: 'B', x: 0, y: 0 }] });
  store.getState().undo();
  store.setState({ readOnly: true });
  const before = store.getState();
  store.getState().undo();
  store.getState().redo();
  expect(store.getState()).toBe(before);
});

it('copiar y pegar una columna mantiene el original hasta confirmar la nueva ubicación', () => {
  const column = { id: 'column', catalogId: 'builtin:column-rectangular' as const, x: 1000, y: 0,
    widthMm: 400, depthMm: 400, heightMm: 2700, elevationMm: 0, rotation: 0, materialId: 'concrete-grey', color: '#a6a6a0' };
  const store = createEditorStore(addColumn(emptyEditorDocument(), column));
  const before = store.getState().document;
  store.getState().copySpatial(column.id);
  store.getState().beginPasteSpatial();
  const pending = store.getState().pendingSpatial!;
  expect(pending.id).not.toBe(column.id);
  expect(store.getState().document).toBe(before);
  expect(store.getState().past).toHaveLength(0);
  store.getState().placePendingSpatial({ ...pending, x: 2400, y: 0 });
  expect(store.getState().document.columns).toHaveLength(2);
  expect(store.getState().document.columns![1]).toMatchObject({ ...column, id: pending.id, x: 2400 });
  expect(store.getState().selection).toEqual([pending.id]);
  store.getState().undo();
  expect(store.getState().document.columns).toEqual([column]);
});

it('50 gestos undo/redo reconstruyen exactamente el documento sin mezclar instancias', () => {
  const initial = emptyEditorDocument();
  const a = createEditorStore(initial), b = createEditorStore(initial);
  for (let i = 0; i < 50; i++) {
    const next = structuredClone(a.getState().document);
    next.labels.push({ id: `label-${i}`, text: `Nota ${i}`, x: i * 100, y: 100 });
    a.getState().apply(next);
  }
  const edited = structuredClone(a.getState().document);
  for (let i = 0; i < 50; i++) a.getState().undo();
  expect(a.getState().document).toEqual(initial);
  for (let i = 0; i < 50; i++) a.getState().redo();
  expect(a.getState().document).toEqual(edited);
  expect(b.getState().document).toEqual(initial);
  expect(a.getState().sequence).toBe(150);
});

it('un gesto inválido no cambia documento ni historia', () => {
  const store = createEditorStore(emptyEditorDocument());
  const next = structuredClone(store.getState().document);
  next.vertices.push({ id: 'bad', x: NaN, y: 0 });
  expect(() => store.getState().apply(next)).toThrow();
  expect(store.getState().sequence).toBe(0);
  expect(store.getState().past).toHaveLength(0);
});
