import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { createEditorStore, sidePanelForSelection } from '@/canvas/editor-v2/store';
import { setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { eligibleCeilingRooms } from '@/lib/editor-document/ceiling-geometry';
import { putWalkthrough, waypoint } from '@/lib/editor-document/walkthrough';

function roomStore() {
  const square = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
  const store = createEditorStore(addWallPath(emptyEditorDocument(), square, true));
  const room = eligibleCeilingRooms(store.getState().document)[0]!;
  store.getState().apply(setRoomCeiling(store.getState().document, room.id, {}));
  return store;
}

it('abrir un panel lateral cierra el que estuviera abierto', () => {
  const store = createEditorStore(emptyEditorDocument());
  store.getState().openSidePanel('catalog');
  expect(store.getState().sidePanel).toBe('catalog');
  store.getState().openSidePanel('walkthrough');
  expect(store.getState().sidePanel).toBe('walkthrough');
});

it('el mismo panel se conmuta y se cierra con closeSidePanel', () => {
  const store = createEditorStore(emptyEditorDocument());
  store.getState().toggleSidePanel('context');
  expect(store.getState().sidePanel).toBe('context');
  store.getState().toggleSidePanel('context');
  expect(store.getState().sidePanel).toBeNull();
  store.getState().toggleSidePanel('context');
  store.getState().closeSidePanel();
  expect(store.getState().sidePanel).toBeNull();
});

it('seleccionar un muro no abre el lateral; Propiedades se abre a petición', () => {
  const store = createEditorStore(emptyEditorDocument());
  store.getState().select(['muro-1']);
  expect(store.getState().sidePanel).toBeNull();
  store.getState().openSidePanel('inspector');
  expect(store.getState().sidePanel).toBe('inspector');
  store.getState().select(['muro-2']);
  expect(store.getState().sidePanel).toBe('inspector');
  store.getState().select([]);
  expect(store.getState().sidePanel).toBeNull();
});

it('elegir un techo abre Techo y luces, pero otro elemento no abre Propiedades', () => {
  const store = createEditorStore(roomStore().getState().document);
  const ceilingId = store.getState().document.ceilings![0]!.id;
  store.getState().select([ceilingId]);
  expect(store.getState().sidePanel).toBe('ceiling');
  store.getState().select([store.getState().document.walls[0]!.id]);
  expect(store.getState().sidePanel).toBeNull();
});

it('deseleccionar desde Techo y luces no cierra el panel', () => {
  const store = createEditorStore(emptyEditorDocument());
  store.getState().openSidePanel('ceiling');
  store.getState().select([]);
  expect(store.getState().sidePanel).toBe('ceiling');
});

it('una selección nueva no desplaza el Catálogo ni el Recorrido', () => {
  expect(sidePanelForSelection('catalog', { hasSelection: true, lighting: false })).toBe('catalog');
  expect(sidePanelForSelection('walkthrough', { hasSelection: false, lighting: false })).toBe('walkthrough');
  expect(sidePanelForSelection('catalog', { hasSelection: true, lighting: true })).toBe('ceiling');
});

it('cambiar de herramienta cierra Propiedades pero mantiene Techo y luces', () => {
  const store = createEditorStore(emptyEditorDocument());
  store.getState().openSidePanel('inspector');
  store.getState().setTool('wall');
  expect(store.getState().sidePanel).toBeNull();
  store.getState().openSidePanel('ceiling');
  store.getState().setTool('light-strip');
  expect(store.getState().sidePanel).toBe('ceiling');
});

it('ocultar el recorrido cierra su panel', () => {
  const store = createEditorStore(emptyEditorDocument());
  store.getState().openSidePanel('walkthrough');
  store.getState().hideWalkthrough();
  expect(store.getState().sidePanel).toBeNull();
});

it('editar y localizar un punto conserva el recorrido y su panel abierto', () => {
  const path = { id: 'route', name: 'Recorrido', zoneIds: [], loop: false,
    waypoints: [waypoint({ x: 1000, y: 1000 }), waypoint({ x: 2000, y: 1000 })] };
  const store = createEditorStore(putWalkthrough(emptyEditorDocument(), path));
  store.getState().setWalkthrough(path.id);
  store.getState().openSidePanel('walkthrough');
  store.getState().focusWalkthroughSegment(0);
  store.getState().apply(putWalkthrough(store.getState().document, { ...path,
    waypoints: [path.waypoints[0]!, { ...path.waypoints[1]!, y: 1200 }] }));
  store.getState().select(['mueble']);
  expect(store.getState()).toMatchObject({ walkthroughId: path.id, walkthroughFocusIndex: 0,
    sidePanel: 'walkthrough' });
  store.getState().closeSidePanel();
  store.getState().openSidePanel('walkthrough');
  expect(store.getState().walkthroughId).toBe(path.id);
});
