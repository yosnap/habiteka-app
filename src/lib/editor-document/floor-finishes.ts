import type { EditorDocument, FloorFinish } from './schema';
import { upgradeSpatialDocument } from './spatial-properties';
import { parseEditorDocument } from './validation';
import { deriveRooms } from './rooms';
import { wallConstruction } from './construction-properties';

export function floorFinish(doc: EditorDocument, roomId: string): FloorFinish {
  return doc.floorFinishes?.find((f) => f.roomId === roomId) ?? {
    roomId, color: '#c7ae88', texture: 'none', tileSizeMm: 600, rotation: 0, elevationMm: 0,
  };
}

/**
 * An unspecified depth means a solid podium to the base plane. This avoids a
 * visually unsupported floating sheet after a ramp raises a room. Authors can
 * explicitly set a smaller depth when modelling a basement or a lower floor.
 */
export function floorSlabThicknessMm(finish: FloorFinish): number {
  const elevationMm = finish.elevationMm ?? 0;
  if (elevationMm <= 0) return 0;
  return Math.min(finish.slabThicknessMm ?? elevationMm, elevationMm);
}
/** Floors have their own level. Walls always remain measured from the building base. */
export function normalizeRoomWallBases(doc: EditorDocument, roomId: string): void {
  const room = deriveRooms(doc).find((candidate) => candidate.id === roomId);
  if (!room) throw new Error('Selecciona una habitación cerrada');
  doc.walls.filter((wall) => room.wallIds.includes(wall.id)).forEach((wall) => {
    delete wall.baseElevationMm;
    doc.openings.filter((opening) => opening.wallId === wall.id && opening.sourceRampId).forEach((opening) => {
      opening.heightMm = wallConstruction(wall).heightMm - (opening.elevationMm ?? 0);
    });
  });
}
export function setFloorFinish(source: EditorDocument, roomId: string, patch: Partial<Omit<FloorFinish, 'roomId'>>): EditorDocument {
  if (!deriveRooms(source).some((room) => room.id === roomId)) throw new Error('Selecciona una habitación cerrada');
  const doc = upgradeSpatialDocument(source);
  if (doc.schemaVersion < 5) doc.schemaVersion = 5;
  doc.floorFinishes ??= [];
  if (patch.elevationMm !== undefined) normalizeRoomWallBases(doc, roomId);
  doc.floorFinishes = [...(doc.floorFinishes ?? []).filter((f) => f.roomId !== roomId), { ...floorFinish(doc, roomId), ...patch, roomId }];
  doc.revision += 1;
  return parseEditorDocument(doc);
}
