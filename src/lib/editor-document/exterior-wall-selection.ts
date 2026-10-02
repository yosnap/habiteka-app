import type { EditorDocument } from './schema';
import { eligibleCeilingRooms, insideRoom } from './ceiling-geometry';
import { wallPoints } from './geometry';

/**
 * Fachadas: muro físico que delimita una sola estancia interior. Cuenta también
 * la pared compartida con un patio lógico; un tabique entre dos interiores no.
 */
export function wallSelectionGroups(doc: EditorDocument): { exterior: string[]; interior: string[] } {
  let rooms;
  try { rooms = eligibleCeilingRooms(doc); } catch { return { exterior: [], interior: [] }; }
  const count = new Map<string, number>();
  for (const room of rooms)
    for (const id of room.wallIds) count.set(id, (count.get(id) ?? 0) + 1);
  const exterior: string[] = [], interior: string[] = [];
  for (const wall of doc.walls.filter((item) => !item.hidden)) {
    const adjacent = count.get(wall.id) ?? 0;
    if (adjacent === 1) exterior.push(wall.id);
    else if (adjacent >= 2) interior.push(wall.id);
    else {
      // Tabique abierto dentro de una habitación: no delimita otra cara cerrada.
      const [a, b] = wallPoints(doc, wall), middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (rooms.some((room) => insideRoom(middle, room.boundary))) interior.push(wall.id);
    }
  }
  return { exterior, interior };
}

export const exteriorWallIds = (doc: EditorDocument) => wallSelectionGroups(doc).exterior;
export const interiorWallIds = (doc: EditorDocument) => wallSelectionGroups(doc).interior;
