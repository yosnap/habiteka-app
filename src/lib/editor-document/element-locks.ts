import type { EditorDocument } from './schema';
import { ELEMENT_COLLECTIONS, expandElementGroups } from './element-groups';
import { deriveRoomsSafe } from './rooms';
import { insideRoom } from './ceiling-geometry';

const lockCache = new WeakMap<EditorDocument, Set<string>>();

export function lockedElementIds(doc: EditorDocument): Set<string> {
  const cached = lockCache.get(doc);
  if (cached) return cached;
  const ids = new Set(expandElementGroups(doc, doc.lockedElementIds ?? []));
  if (ids.size) {
    const rooms = deriveRoomsSafe(doc);
    let count = -1;
    while (count !== ids.size) {
      count = ids.size;
      expandElementGroups(doc, [...ids]).forEach(id => ids.add(id));
      for (const group of doc.elementGroups ?? []) if (group.elementIds.some(id => ids.has(id))) ids.add(group.id);
      for (const room of rooms) if (ids.has(room.id)) room.wallIds.forEach(id => ids.add(id));
      for (const opening of doc.openings) if (ids.has(opening.wallId)) ids.add(opening.id);
      for (const ceiling of doc.ceilings ?? []) if (ids.has(ceiling.roomId)) ids.add(ceiling.id);
      for (const light of doc.luminaires ?? []) if (ids.has(light.ceilingId)) ids.add(light.id);
      for (const item of doc.furniture) if (item.hostId && ids.has(item.hostId)) ids.add(item.id);
      for (const boundary of doc.boundaries ?? []) if (ids.has(boundary.id))
        boundary.construction.gates.forEach(gate => ids.add(gate.id));
      for (const run of doc.kitchenRuns ?? []) if (ids.has(run.id)) run.kitchen.slots.forEach(slot => ids.add(slot.id));
    }
  }
  lockCache.set(doc, ids);
  return ids;
}

export const isElementLocked = (doc: EditorDocument, id: string) => lockedElementIds(doc).has(id);

export function setElementLocks(doc: EditorDocument, ids: string[], locked: boolean): EditorDocument {
  const targets = expandElementGroups(doc, ids), current = new Set(doc.lockedElementIds ?? []);
  targets.forEach(id => locked ? current.add(id) : current.delete(id));
  // Desbloquear una pieza protegida por un contenedor también libera ese origen del bloqueo.
  if (!locked) for (const id of [...current]) {
    const scope = lockedElementIds({ ...doc, lockedElementIds: [id] });
    if (targets.some(target => scope.has(target))) current.delete(id);
  }
  return { ...doc, lockedElementIds: [...current] };
}

/** Incluye soportes: una ventana bloqueada tampoco se mueve indirectamente al mover su pared. */
function snapshot(doc: EditorDocument, id: string, visited = new Set<string>()): unknown {
  if (visited.has(id)) return id;
  visited.add(id);
  const entity = ELEMENT_COLLECTIONS.map(key => doc[key]?.find(item => item.id === id)).find(Boolean);
  const wall = doc.walls.find(item => item.id === id);
  const opening = doc.openings.find(item => item.id === id);
  const ceiling = doc.ceilings?.find(item => item.id === id);
  const light = doc.luminaires?.find(item => item.id === id);
  const furniture = doc.furniture.find(item => item.id === id);
  const room = deriveRoomsSafe(doc).find(item => item.id === id);
  const gate = doc.boundaries?.find(item => item.construction.gates.some(child => child.id === id));
  const slot = doc.kitchenRuns?.find(item => item.kitchen.slots.some(child => child.id === id));
  const group = doc.elementGroups?.find(item => item.elementIds.includes(id));
  return { entity, group,
    comments: doc.comments?.filter(comment => comment.targetEntityId === id),
    wall: wall && [doc.vertices.find(v => v.id === wall.startVertexId), doc.vertices.find(v => v.id === wall.endVertexId),
      doc.openings.filter(item => item.wallId === id)],
    support: [opening?.wallId, ceiling?.roomId, light?.ceilingId, furniture?.hostId, gate?.id, slot?.id]
      .filter((key): key is string => Boolean(key)).map(key => snapshot(doc, key, visited)),
    room: room && { boundary: room.boundary, walls: room.wallIds.map(key => snapshot(doc, key, visited)),
      finish: doc.floorFinishes?.find(item => item.roomId === id),
      labels: doc.labels.filter(item => insideRoom(item, room.boundary)) },
  };
}

function assertLevelLocks(before: EditorDocument, after: EditorDocument | undefined): void {
  const ids = lockedElementIds(before);
  for (const id of ids) {
    if (!after || JSON.stringify(snapshot(before, id)) !== JSON.stringify(snapshot(after, id)))
      throw new Error('Hay elementos bloqueados afectados. Desbloquea el elemento o su grupo en Escena antes de modificarlo.');
  }
}

/** Se ejecuta después de reconciliar geometría y soportes, también en plantas inactivas. */
export function assertLockedElementsUnchanged(before: EditorDocument, after: EditorDocument): void {
  const target = before.activeLevelId && after.levels
    ? (after.activeLevelId === before.activeLevelId ? after : after.levels.find(level => level.id === before.activeLevelId)?.document)
    : after.activeLevelId && after.levels ? after.levels.find(level => level.document)?.document ?? after : after;
  assertLevelLocks(before, target);
  for (const level of before.levels ?? []) if (level.document) {
    assertLevelLocks(level.document, after.activeLevelId === level.id ? after : after.levels?.find(item => item.id === level.id)?.document);
  }
}
