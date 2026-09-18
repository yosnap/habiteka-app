import type { EditorDocument, Point } from './schema';
import { deriveRooms, type DerivedRoom } from './rooms';
import { parseEditorDocument } from './validation';
import { insideRoom } from './ceiling-geometry';

export const editableOutdoorRoom = (doc: EditorDocument, room: DerivedRoom) =>
  room.wallIds.some((id) => id.startsWith('outdoor:'));

/** Los vértices compartidos con la casa permanecen fijos; solo cambia el patio. */
export function moveOutdoorRoom(source: EditorDocument, id: string, delta: Point): EditorDocument {
  const room = deriveRooms(source).find((r) => r.id === id);
  if (!room || !editableOutdoorRoom(source, room)) throw new Error('Selecciona un patio dibujado');
  const doc = structuredClone(source);
  const movable = room.vertexIds.filter((vertexId) => !source.walls.some((wall) =>
    (!wall.id.startsWith('outdoor:') || !room.wallIds.includes(wall.id)) && (wall.startVertexId === vertexId || wall.endVertexId === vertexId)));
  if (!movable.length) throw new Error('Este patio comparte todos sus vértices con la construcción');
  doc.vertices.filter((v) => movable.includes(v.id)).forEach((v) => { v.x += delta.x; v.y += delta.y; });
  const changed = deriveRooms(doc).find((r) => r.id === id);
  if (!changed) throw new Error('El movimiento no conserva el contorno del patio');
  const before = room.boundary.reduce((p, v) => ({ x: p.x + v.x / room.boundary.length, y: p.y + v.y / room.boundary.length }), { x: 0, y: 0 });
  const after = changed.boundary.reduce((p, v) => ({ x: p.x + v.x / changed.boundary.length, y: p.y + v.y / changed.boundary.length }), { x: 0, y: 0 });
  doc.labels.filter((label) => /patio|terraza/i.test(label.text) && insideRoom(label, room.boundary))
    .forEach((label) => { label.x += after.x - before.x; label.y += after.y - before.y; });
  doc.revision++; return parseEditorDocument(doc);
}

export function deleteOutdoorRoom(source: EditorDocument, id: string): EditorDocument {
  const rooms = deriveRooms(source), room = rooms.find((r) => r.id === id);
  if (!room || !editableOutdoorRoom(source, room)) throw new Error('Selecciona un patio dibujado');
  const doc = structuredClone(source);
  const removable = room.wallIds.filter((wallId) => wallId.startsWith('outdoor:') && !rooms.some((r) => r.id !== id && r.wallIds.includes(wallId)));
  doc.walls = doc.walls.filter((w) => !removable.includes(w.id));
  doc.vertices = doc.vertices.filter((v) => doc.walls.some((w) => w.startVertexId === v.id || w.endVertexId === v.id));
  doc.floorFinishes = doc.floorFinishes?.filter((f) => f.roomId !== id);
  doc.labels = doc.labels.filter((label) => !(/patio|terraza/i.test(label.text) && insideRoom(label, room.boundary)));
  doc.revision++; return parseEditorDocument(doc);
}
