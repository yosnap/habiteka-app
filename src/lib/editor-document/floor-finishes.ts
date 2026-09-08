import type { EditorDocument, FloorFinish } from './schema';
import { upgradeSpatialDocument } from './spatial-properties';
import { parseEditorDocument } from './validation';
import { deriveRooms } from './rooms';

export function floorFinish(doc: EditorDocument, roomId: string): FloorFinish {
  return doc.floorFinishes?.find((f) => f.roomId === roomId) ?? {
    roomId, color: '#c7ae88', texture: 'none', tileSizeMm: 600, rotation: 0,
  };
}
export function setFloorFinish(source: EditorDocument, roomId: string, patch: Partial<Omit<FloorFinish, 'roomId'>>): EditorDocument {
  if (!deriveRooms(source).some((room) => room.id === roomId)) throw new Error('Selecciona una habitación cerrada');
  const doc = upgradeSpatialDocument(source);
  doc.schemaVersion = 5;
  doc.floorFinishes = [...(doc.floorFinishes ?? []).filter((f) => f.roomId !== roomId), { ...floorFinish(doc, roomId), ...patch, roomId }];
  doc.revision += 1;
  return parseEditorDocument(doc);
}
