import type { EditorDocument, Wall } from './schema';
import { deriveRooms } from './rooms';

/** Face semantics come from bounded room winding, never from drawing direction. */
export function wallFaces(doc: EditorDocument, wall: Wall): { side: 'left' | 'right'; label: string }[] {
  const interior = new Map<'left' | 'right', number>();
  let rooms;
  try { rooms = deriveRooms(doc); } catch { return []; }
  rooms.forEach((room, index) => {
    const edge = room.wallIds.indexOf(wall.id);
    if (edge < 0) return;
    interior.set(room.vertexIds[edge] === wall.startVertexId ? 'left' : 'right', index + 1);
  });
  if (!interior.size) return [];
  const sides = ['left', 'right'] as const;
  return sides.map((side) => ({ side, label: interior.size === 2
    ? `Interior · habitación ${interior.get(side)}` : interior.has(side) ? 'Interior' : 'Exterior' }))
    .sort((a, b) => Number(a.label === 'Exterior') - Number(b.label === 'Exterior'));
}
