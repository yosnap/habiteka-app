import { expect, it } from 'vitest';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { visualSampleDocument } from '@/app/dev/editor-v2/visual-sample';
import { resetPreviewSample } from '@/app/dev/editor-v2/reset-preview-sample';

it('recupera la muestra normalizada y permite deshacer y rehacer el restablecimiento', () => {
  const initial = visualSampleDocument();
  const previous = createEditorStore(initial);
  const edited = { ...previous.getState().document,
    furniture: previous.getState().document.furniture.filter(item => item.id !== 'wardrobe') };
  previous.getState().apply(edited);
  const beforeReset = previous.getState().document;
  const store = resetPreviewSample(previous, initial);
  const restored = store.getState().document;
  expect(restored).toEqual(createEditorStore(initial).getState().document);
  expect(restored.furniture.some(item => item.id === 'wardrobe')).toBe(true);
  expect(store.getState().sequence).toBe(previous.getState().sequence + 1);
  expect(previous.getState().document).toBe(beforeReset);
  store.getState().undo();
  expect(store.getState().document).toEqual(beforeReset);
  store.getState().redo();
  expect(store.getState().document).toEqual(restored);
});

it('cancela la colocación, paneles, cámara, recorrido y errores de la sesión anterior', () => {
  const previous = createEditorStore(visualSampleDocument());
  previous.getState().copySpatial('wardrobe');
  previous.getState().beginPasteSpatial();
  previous.getState().openSidePanel('catalog');
  previous.getState().setPan(true);
  previous.getState().setSnap(false);
  previous.getState().setWalkthrough('old-route');
  previous.getState().setWalkthroughPlaying(true);
  previous.getState().focusOn({ x: 2000, y: 1000 });
  previous.getState().requestView('zoom-in');
  previous.getState().setError('Error anterior');
  const store = resetPreviewSample(previous, emptyEditorDocument());
  expect(store.getState()).toMatchObject({ tool: 'select', selection: [], sidePanel: null,
    pendingSpatial: null, clipboardSpatial: null, pendingOpening: null, pendingSplitWallId: null,
    pan: false, snap: true, magneticGuides: [], focusPoint: null, viewRequest: null,
    walkthroughId: null, walkthroughPlaying: false, lightZoneDraw: null, activeLightZoneId: null, error: null });
  store.getState().placePendingSpatial(previous.getState().pendingSpatial!);
  expect(store.getState().document.furniture).toHaveLength(0);
  // Las acciones de la instancia nueva no deben modificar la copia previa.
  store.getState().openSidePanel('inspector');
  expect(previous.getState().sidePanel).toBe('catalog');
});
