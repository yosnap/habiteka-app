import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { editSelectionProperties, selectionPropertyScope, selectPropertyElement } from '@/canvas/editor-v2/selection-properties';
import { setWallConstruction } from '@/lib/editor-document/construction-commands';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { wallConstruction } from '@/lib/editor-document/construction-properties';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { floorFinish, setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';

const house = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 4000 }, { x: 0, y: 4000 }], true);

describe('propiedades y selección', () => {
  it('buscar conserva el panel incluso desde una herramienta de dibujo', () => {
    const store = createEditorStore(house()), id = store.getState().document.walls[0]!.id;
    store.getState().setTool('wall');
    selectPropertyElement(store, id);
    expect(store.getState()).toMatchObject({ tool: 'select', sidePanel: 'inspector', selection: [id] });
    store.getState().setDetailPanel('paint');
    selectPropertyElement(store, store.getState().document.walls[1]!.id);
    expect(store.getState()).toMatchObject({ sidePanel: 'inspector', detailPanel: null });
    store.getState().select([]);
    expect(store.getState().sidePanel).toBe('inspector');
  });

  it('acabados y notas abren Propiedades; al cerrarlo no dejan un panel flotante', () => {
    const store = createEditorStore(house());
    store.getState().select([store.getState().document.walls[0]!.id]);
    store.getState().setDetailPanel('comments');
    expect(store.getState()).toMatchObject({ sidePanel: 'inspector', detailPanel: 'comments' });
    store.getState().closeSidePanel();
    expect(store.getState()).toMatchObject({ sidePanel: null, detailPanel: null });
    store.getState().openSidePanel('ceiling');
    store.getState().setDetailPanel('paint');
    expect(store.getState().sidePanel).toBe('ceiling');
  });

  it('bloquea campos conjuntos si se mezclan paredes con habitaciones', () => {
    const store = createEditorStore(house()), doc = store.getState().document;
    store.getState().select([doc.walls[0]!.id, deriveRoomsSafe(doc)[0]!.id]);
    expect(selectionPropertyScope(doc, store.getState().selection).mixed).toBe(true);
    expect(editSelectionProperties(store, (current) => setWallConstruction(current, doc.walls[0]!.id, { heightMm: 3300 }))).toBe(false);
    expect(store.getState().document).toBe(doc);
    expect(store.getState().past).toHaveLength(0);
  });

  it('aplica altura a todas las paredes seleccionadas y permite deshacer en un paso', () => {
    const store = createEditorStore(house()), doc = store.getState().document;
    const ids = doc.walls.slice(0, 2).map((wall) => wall.id);
    store.getState().select(ids);
    expect(editSelectionProperties(store, (current) => setWallConstruction(current, ids[0]!, { heightMm: 3300 }))).toBe(true);
    expect(store.getState().document.walls.slice(0, 2).map((wall) => wallConstruction(wall).heightMm)).toEqual([3300, 3300]);
    expect(wallConstruction(store.getState().document.walls[2]!)).toEqual(wallConstruction(doc.walls[2]!));
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().document).toEqual(doc);
  });

  it('rechaza toda la edición si el segundo mueble atravesaría una pared', () => {
    const doc = upgradeSpatialDocument(house());
    doc.furniture = [1000, 7000].map((x, i) => ({ id: `chair-${i}`, kind: 'chair', x, y: 1000,
      widthMm: 500, depthMm: 500, heightMm: 800, elevationMm: 0, color: '#678987', rotation: 0, dimensionalOrigin: 'physical' }));
    const store = createEditorStore(doc), initial = store.getState().document;
    store.getState().select(['chair-0', 'chair-1']);
    expect(editSelectionProperties(store, (current) => updateFurniture(current, 'chair-0', { widthMm: 2000 }))).toBe(false);
    expect(store.getState().document).toBe(initial);
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().error).toBeTruthy();
  });

  it('editar la cota de una habitación conserva sus acabados', () => {
    const doc = house(), room = deriveRoomsSafe(doc)[0]!;
    const store = createEditorStore(setFloorFinish(doc, room.id, { color: '#678987', texture: 'wood' }));
    store.getState().select([room.id]);
    expect(editSelectionProperties(store, (current) => setFloorFinish(current, room.id, { elevationMm: 200 }))).toBe(true);
    expect(floorFinish(store.getState().document, room.id)).toMatchObject({ color: '#678987', texture: 'wood', elevationMm: 200 });
  });

  it('solo lectura permite inspeccionar sin aplicar cambios', () => {
    const store = createEditorStore(house(), { readOnly: true }), doc = store.getState().document;
    selectPropertyElement(store, doc.walls[0]!.id);
    store.getState().setDetailPanel('paint');
    expect(editSelectionProperties(store, (current) => setWallConstruction(current, doc.walls[0]!.id, { heightMm: 3300 }))).toBe(false);
    expect(store.getState().document).toBe(doc);
    expect(store.getState()).toMatchObject({ sidePanel: 'inspector', detailPanel: 'paint' });
  });
});
