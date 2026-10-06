import type { EditorDocument, Wall } from './schema';
import { deriveRooms } from './rooms';
import { selectedWallSides } from './wall-bulk-appearance';

/** Face semantics come from bounded room winding, never from drawing direction. */
export function wallFaces(doc: EditorDocument, wall: Wall): { side: 'left' | 'right'; label: string }[] {
  if (wall.classification === 'interior') return [
    { side: 'left', label: 'Interior · cara izquierda' }, { side: 'right', label: 'Interior · cara derecha' },
  ];
  if (wall.classification === 'exterior') {
    const outside = selectedWallSides(doc, wall.id, 'exterior')[0] ?? 'right';
    return [{ side: outside === 'left' ? 'right' : 'left', label: 'Interior' }, { side: outside, label: 'Exterior' }];
  }
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
