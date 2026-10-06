import type { EditorDocument, Wall } from './schema';
import type { DerivedRoom } from './rooms';
import { parseEditorDocument } from './validation';
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
    if (wall.classification) { (wall.classification === 'exterior' ? exterior : interior).push(wall.id); continue; }
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

export function wallClassificationInfo(doc: EditorDocument, wall: Wall) {
  let rooms: DerivedRoom[] = [];
  try { rooms = eligibleCeilingRooms(doc); } catch { /* El motivo avisa de la geometría incompleta. */ }
  const adjacent = rooms.filter(room => room.wallIds.includes(wall.id)).length;
  const [a, b] = wallPoints(doc, wall);
  const inside = rooms.some(room => insideRoom({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, room.boundary));
  const automatic = adjacent === 1 ? 'exterior' : adjacent >= 2 || inside ? 'interior' : null;
  return { automatic, effective: wall.classification ?? automatic,
    reason: adjacent === 1 ? 'Delimita una sola estancia interior; el otro lado puede ser un patio o el exterior.'
      : adjacent >= 2 ? 'Separa dos estancias interiores.' : inside ? 'Es un tabique dentro de una estancia interior.'
        : 'No se ha identificado una estancia interior junto a esta pared.' };
}

/** Una revisión para toda la selección. No cambia muros, etiquetas ni el ámbito del tejado. */
export function setWallClassification(input: EditorDocument, ids: string[], value: 'auto' | 'interior' | 'exterior'): EditorDocument {
  if (!['auto', 'interior', 'exterior'].includes(value)) throw new Error('Clasificación de pared inválida');
  const doc = structuredClone(input);
  for (const id of ids) {
    const wall = doc.walls.find(item => item.id === id);
    if (!wall || wall.hidden) throw new Error('Selecciona una pared visible');
    if (value === 'auto') delete wall.classification;
    else wall.classification = value;
  }
  doc.revision++;
  return parseEditorDocument(doc);
}
