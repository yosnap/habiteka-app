import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';
import { addWallPath, deleteEntities, moveEntity } from '@/canvas/editor-v2/editing-operations';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { clickSelect } from '@/canvas/editor-v2/selection-click';
import { groupElements, ungroupElements } from '@/lib/editor-document/element-groups';
import { isElementLocked } from '@/lib/editor-document/element-locks';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { upgradeLightingDocument } from '@/lib/editor-document/lighting-migration';
import { addBuildingLevel, removeBuildingLevel, switchBuildingLevel } from '@/lib/editor-document/building-levels';
import { extractElementPackage, insertElementPackage, packageCategory } from '@/lib/editor-document/element-packages';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { nudgeElements } from '@/canvas/editor-v2/nudge-elements';
import { sceneTree } from '@/components/editor-v2/workspace/workspace-scene-tree';
import { replaceFurniture } from '@/lib/editor-document/replace-element';
import { FURNITURE_CATALOG } from '@/lib/editor-document/furniture-catalog';
import { objectCenter } from '@/lib/editor-document/spatial-properties';
import { setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import { deriveRooms } from '@/lib/editor-document/rooms';

function furnitureDocument(): EditorDocument {
  const doc = upgradeLightingDocument(emptyEditorDocument());
  doc.furniture = ['a', 'b', 'c'].map((id, i) => ({ id, kind: 'sofa', catalogId: 'builtin:sofa',
    x: i * 4000, y: 0, widthMm: 1600, depthMm: 800, heightMm: 800, elevationMm: 0,
    rotation: 0, color: '#888888', dimensionalOrigin: 'physical' }));
  return doc;
}

describe('bloqueos persistentes y grupos', () => {
  it('bloquea todo el grupo y rechaza cambios, borrado y desagrupación sin alterar la historia', () => {
    const store = createEditorStore(groupElements(furnitureDocument(), ['a', 'b'], 'Salón'));
    store.getState().setElementsLocked(['a'], true);
    const before = store.getState().document, history = store.getState().past.length;
    expect(isElementLocked(before, 'b')).toBe(true);
    expect(() => store.getState().apply(updateFurniture(before, 'b', { x: 4500 }))).toThrow('bloqueados');
    expect(() => store.getState().apply(deleteEntities(before, ['b', 'c']))).toThrow('bloqueados');
    expect(() => store.getState().apply(ungroupElements(before, ['a']))).toThrow('bloqueados');
    expect(store.getState().document).toEqual(before);
    expect(store.getState().past).toHaveLength(history);
    store.getState().setElementsLocked(['b'], false);
    expect(isElementLocked(store.getState().document, 'a')).toBe(false);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(before)))).toEqual(before);
  });
  it('permite modificar un elemento ajeno al grupo bloqueado', () => {
    const store = createEditorStore(groupElements(furnitureDocument(), ['a', 'b'], 'Salón'));
    store.getState().setElementsLocked(['a'], true);
    store.getState().apply(updateFurniture(store.getState().document, 'c', { color: '#123456' }));
    expect(store.getState().document.furniture[2]!.color).toBe('#123456');
  });
  it('protege los vértices compartidos de las paredes bloqueadas', () => {
    const store = createEditorStore(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }]));
    const id = store.getState().document.walls[0]!.id;
    store.getState().setElementsLocked([id], true);
    expect(store.getState().error).toBeNull();
    const before = store.getState().document, next = structuredClone(before);
    next.vertices[0]!.x = -200;
    expect(() => store.getState().apply(next)).toThrow('bloqueados');
    store.getState().undo();
    expect(isElementLocked(store.getState().document, id)).toBe(false);
    store.getState().redo();
    expect(isElementLocked(store.getState().document, id)).toBe(true);
  });
  it('mantiene los bloqueos al cambiar de planta e impide borrar una planta bloqueada', () => {
    const store = createEditorStore(furnitureDocument());
    store.getState().setElementsLocked(['a'], true);
    store.getState().apply(addBuildingLevel(store.getState().document));
    const ground = store.getState().document.levels![0]!.id;
    expect(() => store.getState().apply(removeBuildingLevel(store.getState().document, ground))).toThrow('bloqueados');
    store.getState().apply(switchBuildingLevel(store.getState().document, ground));
    expect(isElementLocked(store.getState().document, 'a')).toBe(true);
  });
  it('selecciona, mueve y deselecciona el grupo; admite inspección individual', () => {
    const store = createEditorStore(groupElements(furnitureDocument(), ['a', 'b'], 'Salón'));
    clickSelect(store, 'a', {});
    expect(store.getState().selection).toEqual(['a', 'b']);
    clickSelect(store, 'a', { shiftKey: true });
    expect(store.getState().selection).toEqual([]);
    store.getState().select(['b'], true);
    expect(store.getState().selection).toEqual(['b']);
    const moved = moveEntity(store.getState().document, 'a', { x: 100, y: 200 });
    expect(moved.furniture.map(item => [item.x, item.y])).toEqual([[100, 200], [4100, 200], [8000, 0]]);
    const nudged = nudgeElements(store.getState().document, ['a', 'b'], { x: 100, y: 0 });
    expect(nudged.furniture[1]!.x).toBe(4100);
    const tree = sceneTree(store.getState().document, []);
    expect(tree.find(item => item.group === 'Grupos')!.children.map(item => item.id)).toEqual(['a', 'b']);
    expect(tree.some(item => item.id === 'a')).toBe(false);
  });
  it('borra un grupo como una sola acción y permite deshacerlo', () => {
    const store = createEditorStore(groupElements(furnitureDocument(), ['a', 'b'], 'Salón'));
    store.getState().apply(deleteEntities(store.getState().document, ['a']));
    expect(store.getState().document.furniture.map(item => item.id)).toEqual(['c']);
    expect(store.getState().document.elementGroups).toEqual([]);
    store.getState().undo();
    expect(store.getState().document.elementGroups).toHaveLength(1);
  });
});

describe('paquetes y sustitución', () => {
  it('deja pendiente un paquete que colisiona, sin guardar ningún elemento parcial', () => {
    const store = createEditorStore(furnitureDocument());
    const before = store.getState().document;
    store.getState().beginPlacePackage({ name: 'Sofá', document: extractElementPackage(before, ['a']) });
    store.getState().placePendingPackage({ x: 800, y: 400 });
    expect(store.getState().error).toBeTruthy();
    expect(store.getState().pendingPackage).not.toBeNull();
    expect(store.getState().document).toBe(before);
    expect(store.getState().past).toHaveLength(0);
  });
  it('remapea habitaciones y techos sin perder la asociación de luminarias', () => {
    const roomDoc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 6000 }, { x: 0, y: 6000 }], true);
    const doc = setRoomCeiling(roomDoc, deriveRooms(roomDoc)[0]!.id, {});
    doc.luminaires = [{ id: 'light', ceilingId: doc.ceilings![0]!.id, kind: 'pendant', x: 3000, y: 3000,
      dropMm: 100, color: '#ffffff', temperatureK: 3000, lumens: 500, enabled: true }];
    const result = insertElementPackage(emptyEditorDocument(), { name: 'Luz con soporte', document: extractElementPackage(doc, ['light']) }, { x: 12000, y: 12000 });
    expect(result.document.ceilings![0]!.roomId).toBe(deriveRooms(result.document)[0]!.id);
    expect(result.document.luminaires![0]!.ceilingId).toBe(result.document.ceilings![0]!.id);
    expect(result.document.luminaires![0]).toMatchObject({ x: 12000, y: 12000 });
  });
  it('conserva los identificadores de recursos aunque coincidan con un ID de entidad', () => {
    const doc = furnitureDocument();
    doc.furniture[0]!.id = doc.furniture[0]!.catalogId!;
    const result = insertElementPackage(emptyEditorDocument(), { name: 'Sofá', document: extractElementPackage(doc, [doc.furniture[0]!.id]) }, { x: 0, y: 0 });
    expect(result.document.furniture[0]!.catalogId).toBe('builtin:sofa');
    expect(result.document.furniture[0]!.id).not.toBe('builtin:sofa');
  });
  it('rechaza grupos con referencias inexistentes o pertenencia duplicada', () => {
    const doc = groupElements(furnitureDocument(), ['a', 'b'], 'Salón');
    expect(() => parseEditorDocument({ ...doc, elementGroups: [...doc.elementGroups!, { id: 'other', name: 'Otro', elementIds: ['a', 'c'] }] })).toThrow();
    expect(() => parseEditorDocument({ ...doc, elementGroups: [{ id: 'other', name: 'Otro', elementIds: ['a', 'missing'] }] })).toThrow();
  });
  it('inserta copias independientes en otro proyecto con nuevos IDs y una distribución idéntica', () => {
    const source = groupElements(furnitureDocument(), ['a', 'b'], 'Salón');
    const template = extractElementPackage(source, ['a']);
    expect(template.furniture).toHaveLength(2);
    expect(template.elementGroups).toBeUndefined();
    expect(template.lockedElementIds).toBeUndefined();
    expect(packageCategory(template)).toBe('furniture');
    const first = insertElementPackage(emptyEditorDocument(), { name: 'Salón', document: template }, { x: 0, y: 5000 });
    const second = insertElementPackage(first.document, { name: 'Salón', document: template }, { x: 15000, y: 5000 });
    expect(new Set(second.document.furniture.map(item => item.id)).size).toBe(4);
    expect(second.document.elementGroups).toHaveLength(2);
    expect(second.document.furniture[1]!.x - second.document.furniture[0]!.x).toBe(4000);
    expect(second.document.furniture[0]!.id).not.toBe(source.furniture[0]!.id);
    first.document.furniture[0]!.color = '#123456';
    expect(template.furniture[0]!.color).toBe('#888888');
  });
  it('transporta paredes y puertas con sus referencias remapeadas', () => {
    const source = upgradeLightingDocument(addWallPath(emptyEditorDocument(), [{ x: 2000, y: 3000 }, { x: 8000, y: 3000 }]));
    source.openings.push({ id: 'door', catalogId: 'puerta-basic', wallId: source.walls[0]!.id, kind: 'puerta', position: .5, widthMm: 800,
      heightMm: 2100, elevationMm: 0, hinge: 'left', swing: 'left', openAngleDeg: 90, colors: { frame: '#ffffff', leaf: '#ffffff' }, dimensionalOrigin: 'physical' });
    const template = extractElementPackage(source, ['door']);
    expect(packageCategory(template)).toBe('construction');
    expect(template.walls).toHaveLength(1);
    const inserted = insertElementPackage(emptyEditorDocument(), { name: 'Entrada', document: template }, { x: 10000, y: 0 });
    expect(inserted.document.openings[0]!.wallId).toBe(inserted.document.walls[0]!.id);
    expect(inserted.document.walls[0]!.id).not.toBe(source.walls[0]!.id);
    expect(() => parseEditorDocument(inserted.document)).not.toThrow();
  });
  it('coloca un paquete al hacer clic, conserva el pendiente si falla y cancela sin editar', () => {
    const store = createEditorStore(furnitureDocument());
    const pack = { name: 'Salón', document: extractElementPackage(store.getState().document, ['a', 'b']) };
    store.getState().beginPlacePackage(pack);
    store.getState().cancelPendingSpatial();
    expect(store.getState().document.furniture).toHaveLength(3);
    store.getState().beginPlacePackage(pack);
    store.getState().placePendingPackage({ x: 20000, y: 10000 });
    expect(store.getState().pendingPackage).toBeNull();
    expect(store.getState().document.furniture).toHaveLength(5);
    expect(store.getState().selection).toHaveLength(2);
    store.getState().undo();
    expect(store.getState().document.furniture).toHaveLength(3);
  });
  it('sustituye solo una pieza conservando su centro, giro, ID y grupo', () => {
    const source = groupElements(furnitureDocument(), ['a', 'b'], 'Salón');
    source.furniture[0]!.rotation = 37;
    const item = FURNITURE_CATALOG.find(entry => /sofá/i.test(entry.label))!;
    expect(item).toBeDefined();
    const next = replaceFurniture(source, 'a', item);
    expect(objectCenter(next.furniture[0]!)).toEqual(objectCenter(source.furniture[0]!));
    expect(next.furniture[0]).toMatchObject({ id: 'a', rotation: 37, catalogId: item.id, widthMm: item.widthMm, depthMm: item.depthMm });
    expect(next.elementGroups).toEqual(source.elementGroups);
    expect(next.furniture[1]).toEqual(source.furniture[1]);
  });
});
