import { expect, it } from 'vitest';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath, addOpening } from '@/canvas/editor-v2/editing-operations';
import { visualSampleDocument } from '@/app/dev/editor-v2/visual-sample';

it('copia huecos al portapapeles y pegar inicia su colocación sin duplicar aún el documento', () => {
  let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }]);
  doc = addOpening(doc, doc.walls[0]!.id, { x: 2000, y: 0 }, 'puerta');
  const store = createEditorStore(doc), opening = doc.openings[0]!;
  store.getState().copySpatial(opening.id); store.getState().setPan(true); store.getState().beginPasteSpatial();
  expect(store.getState().pendingOpening).toMatchObject({ kind: 'puerta', widthMm: opening.widthMm });
  expect(store.getState().pendingOpening!.id).not.toBe(opening.id);
  expect(store.getState().document.openings).toHaveLength(1);
  expect(store.getState().tool).toBe('door'); expect(store.getState().pan).toBe(false);
});

it('copiar un objeto sustituye el hueco previo y solo lectura impide pegar', () => {
  const store = createEditorStore(visualSampleDocument());
  const opening = store.getState().document.openings[0]!;
  store.getState().copySpatial(opening.id); store.getState().copySpatial('wardrobe');
  expect(store.getState().clipboardOpening).toBeNull();
  store.getState().beginPasteSpatial(); expect(store.getState().pendingSpatial?.id).not.toBe('wardrobe');
  store.getState().cancelPendingSpatial(); store.setState({ readOnly: true });
  store.getState().beginPasteSpatial(); expect(store.getState().pendingSpatial).toBeNull();
});
