import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { ceilingSurfaces, eligibleCeilingRooms } from '@/lib/editor-document/ceiling-geometry';
import { setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import { setSpaceClassification, roomClassification } from '@/lib/editor-document/space-classification';
import { addDesignZone } from '@/lib/editor-document/design-zone-commands';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { sceneTree, filterSceneTree, renameSceneElement } from '@/components/editor-v2/workspace/workspace-scene-tree';
import { createEditorStore } from '@/canvas/editor-v2/store';

const outline = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
const fixture = () => addWallPath(emptyEditorDocument(), outline, true);

it('guarda el tipo explícito, prevalece sobre el nombre y admite automático y deshacer', () => {
  const doc = fixture(), room = deriveRooms(doc)[0]!;
  doc.labels.push({ id: 'name', x: 2000, y: 1500, text: 'Patio' });
  expect(eligibleCeilingRooms(doc)).toHaveLength(0);
  const store = createEditorStore(doc);
  store.getState().apply(setSpaceClassification(doc, room.id, 'interior'));
  const saved = parseEditorDocument(JSON.parse(JSON.stringify(store.getState().document)));
  expect(eligibleCeilingRooms(saved)).toHaveLength(1);
  expect(eligibleCeilingRooms(setSpaceClassification(saved, room.id, 'auto'))).toHaveLength(0);
  store.getState().undo();
  expect(eligibleCeilingRooms(store.getState().document)).toHaveLength(0);
});

it('una zona completa se hereda pero la decisión de la estancia tiene prioridad', () => {
  let doc = addDesignZone(fixture(), 'Zona completa', outline);
  const zone = doc.designZones![0]!, room = deriveRooms(doc)[0]!;
  doc = setSpaceClassification(doc, zone.id, 'exterior');
  expect(roomClassification(doc, room)).toBe('exterior');
  expect(eligibleCeilingRooms(doc)).toHaveLength(0);
  doc = setSpaceClassification(doc, room.id, 'interior');
  expect(eligibleCeilingRooms(doc)).toHaveLength(1);
  expect(parseEditorDocument(JSON.parse(JSON.stringify(doc))).designZones![0]!.classification).toBe('exterior');
});

it('una zona parcial no reclasifica ni destapa toda la estancia', () => {
  let doc = addDesignZone(fixture(), 'Parte', [{ x: 100, y: 100 }, { x: 1000, y: 100 }, { x: 1000, y: 1000 }, { x: 100, y: 1000 }]);
  doc = setSpaceClassification(doc, doc.designZones![0]!.id, 'exterior');
  expect(eligibleCeilingRooms(doc)).toHaveLength(1);
  const rooms = deriveRooms(doc), nodes = sceneTree(doc, rooms);
  expect(filterSceneTree(nodes, 'rooms', 'Parte')).toHaveLength(1);
  expect(filterSceneTree(nodes, 'structure', 'Parte')).toHaveLength(0);
  const renamed = renameSceneElement(doc, doc.designZones![0]!.id, 'Rincón', rooms);
  expect(renamed.designZones![0]).toMatchObject({ name: 'Rincón', classification: 'exterior' });
});

it('rechaza valores de clasificación ajenos al contrato', () => {
  const source = fixture();
  const doc = setSpaceClassification(source, deriveRooms(source)[0]!.id, 'exterior');
  expect(() => parseEditorDocument({ ...doc, floorFinishes: doc.floorFinishes!.map(finish => ({ ...finish, classification: 'invalid' })) })).toThrow();
});

it('exterior excluye un techo existente sin borrarlo y automático lo recupera', () => {
  const source = fixture(), room = deriveRooms(source)[0]!;
  const covered = setRoomCeiling(source, room.id);
  const exterior = setSpaceClassification(covered, room.id, 'exterior');
  expect(ceilingSurfaces(exterior)).toHaveLength(0);
  expect(exterior.ceilings).toEqual(covered.ceilings);
  expect(ceilingSurfaces(setSpaceClassification(exterior, room.id, 'auto'))).toHaveLength(1);
});
