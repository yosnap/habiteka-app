import type { EditorDocument } from './schema';
import { deriveRooms } from './rooms';
import { floorFinish } from './floor-finishes';
import { wallConstruction } from './construction-properties';
import { insideRoom } from './ceiling-geometry';
import { objectCenter } from './spatial-properties';

/**
 * Al cambiar la cota del suelo de una estancia, todo lo que se apoya en ella sube o baja con el suelo:
 * muebles y columnas dentro del contorno, la elevación de puertas y ventanas de sus muros, y la altura de esos
 * muros para conservar la altura libre. Un muro compartido con otra estancia toma como referencia el suelo más
 * alto de las dos, así no crece dos veces si se elevan ambas.
 */
export function syncRoomContentsWithFloor(doc: EditorDocument, roomId: string, previousMm: number, nextMm: number): void {
  const delta = nextMm - previousMm;
  if (!delta) return;
  const rooms = deriveRooms(doc), room = rooms.find((candidate) => candidate.id === roomId);
  if (!room) return;
  const floorOf = (id: string) => id === roomId ? nextMm : (floorFinish(doc, id).elevationMm ?? 0);
  const floorBefore = (id: string) => id === roomId ? previousMm : (floorFinish(doc, id).elevationMm ?? 0);
  for (const wall of doc.walls.filter((candidate) => room.wallIds.includes(candidate.id))) {
    const adjacent = rooms.filter((candidate) => candidate.wallIds.includes(wall.id)).map((candidate) => candidate.id);
    const referenceBefore = Math.max(0, ...adjacent.map(floorBefore)), referenceAfter = Math.max(0, ...adjacent.map(floorOf));
    // La altura se mide desde la base del muro: un murete que ya apoya en un descansillo a la cota nueva no crece.
    const base = wall.baseElevationMm ?? 0, shift = Math.max(base, referenceAfter) - Math.max(base, referenceBefore);
    if (!shift) continue;
    wall.heightMm = Math.max(300, wallConstruction(wall).heightMm + shift);
    for (const opening of doc.openings.filter((candidate) => candidate.wallId === wall.id)) {
      const elevation = opening.elevationMm ?? 0;
      if (elevation >= referenceBefore) opening.elevationMm = Math.max(0, elevation + shift);
    }
  }
  const inside = (item: { x: number; y: number; widthMm: number; depthMm: number; rotation: number }) => insideRoom(objectCenter(item), room.boundary);
  for (const item of doc.furniture) if (inside(item) && (item.elevationMm ?? 0) >= previousMm) item.elevationMm = Math.max(0, (item.elevationMm ?? 0) + delta);
  for (const column of doc.columns ?? []) if (inside(column) && column.elevationMm >= previousMm) column.elevationMm = Math.max(0, column.elevationMm + delta);
}
