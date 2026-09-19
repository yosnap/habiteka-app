import type { EditorDocument, Point } from './schema';
import { deriveRooms, RoomConflictError, type DerivedRoom } from './rooms';
import { parseEditorDocument } from './validation';
import { insideRoom } from './ceiling-geometry';
import { attachOutdoorRoom } from './outdoor-attach';

export const editableOutdoorRoom = (doc: EditorDocument, room: DerivedRoom) =>
  room.wallIds.some((id) => id.startsWith('outdoor:'));

/**
 * Mueve el patio entero conservando su forma. Si estaba acoplado a la casa, se despega: las esquinas compartidas se
 * duplican para el patio y los muros de la casa que hacían de borde se sustituyen por bordes ocultos propios.
 * Al soltarlo junto a una fachada vuelve a acoplarse (attachOutdoorRoom).
 */
export function moveOutdoorRoom(source: EditorDocument, id: string, delta: Point): EditorDocument {
  const room = deriveRooms(source).find((r) => r.id === id);
  if (!room || !editableOutdoorRoom(source, room)) throw new Error('Selecciona un patio dibujado');
  const doc = structuredClone(source), own = new Set(room.wallIds.filter((wallId) => wallId.startsWith('outdoor:')));
  const shared = (vertexId: string) => source.walls.some((wall) => !own.has(wall.id) && (wall.startVertexId === vertexId || wall.endVertexId === vertexId));
  const copies = new Map<string, string>();
  for (const vertexId of room.vertexIds) {
    const vertex = doc.vertices.find((v) => v.id === vertexId)!;
    if (!shared(vertexId)) { vertex.x += delta.x; vertex.y += delta.y; continue; }
    const copy = { id: crypto.randomUUID(), x: vertex.x + delta.x, y: vertex.y + delta.y };
    doc.vertices.push(copy); copies.set(vertexId, copy.id);
  }
  const mapped = (vertexId: string) => copies.get(vertexId) ?? vertexId;
  for (const wallId of room.wallIds) {
    const wall = doc.walls.find((w) => w.id === wallId)!;
    if (own.has(wallId)) { wall.startVertexId = mapped(wall.startVertexId); wall.endVertexId = mapped(wall.endVertexId); continue; }
    doc.walls.push({ id: `outdoor:${crypto.randomUUID()}`, startVertexId: mapped(wall.startVertexId), endVertexId: mapped(wall.endVertexId),
      thicknessMm: 10, dimensionalOrigin: 'physical', hidden: true, heightMm: 100,
      materials: { left: 'plaster-white', right: 'plaster-white' }, colors: { left: '#dddddd', right: '#dddddd' } });
  }
  // El patio movido es la estancia que reúne más bordes propios (el centroide de una forma en U cae fuera de ella).
  let changed: DerivedRoom | undefined;
  try {
    changed = deriveRooms(doc).map((r) => ({ r, score: r.wallIds.filter((wallId) => own.has(wallId)).length }))
      .filter((c) => c.score > 0).sort((a, b) => b.score - a.score)[0]?.r;
  }
  catch (cause) {
    const where = cause instanceof RoomConflictError ? ` Choca en (${(cause.point.x / 1000).toFixed(2)}; ${(cause.point.y / 1000).toFixed(2)}) m, marcado con una cruz.` : '';
    const message = `El patio cruzaría muros de la casa.${where} Acércalo hasta que los imanes lo peguen a la fachada o arrastra sus vértices sobre las esquinas.`;
    throw cause instanceof RoomConflictError ? new RoomConflictError(message, cause.point) : new Error(message);
  }
  if (!changed) throw new Error('El movimiento no conserva el contorno del patio');
  const finish = doc.floorFinishes?.find((f) => f.roomId === id);
  if (finish) finish.roomId = changed.id;
  doc.labels.filter((label) => /patio|terraza/i.test(label.text) && insideRoom(label, room.boundary))
    .forEach((label) => { label.x += delta.x; label.y += delta.y; });
  const attached = attachOutdoorRoom(doc, changed.id);
  attached.revision++; return parseEditorDocument(attached);
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
