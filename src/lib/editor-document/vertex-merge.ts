import type { EditorDocument } from './schema';

/** Fusiona el vértice `id` en `twinId`: rehace los muros que lo usaban y descarta los que quedan degenerados o duplicados. */
export function mergeVertexInto(doc: EditorDocument, id: string, twinId: string): EditorDocument {
  if (id === twinId || !doc.vertices.some((v) => v.id === twinId)) throw new Error('Vértice de destino inexistente');
  const walls = doc.walls.map((wall) => ({ ...wall,
    startVertexId: wall.startVertexId === id ? twinId : wall.startVertexId,
    endVertexId: wall.endVertexId === id ? twinId : wall.endVertexId }));
  const kept: typeof walls = [];
  for (const wall of walls) {
    if (wall.startVertexId === wall.endVertexId) continue;
    const pair = (other: (typeof walls)[number]) => [other.startVertexId, other.endVertexId].every((v) => v === wall.startVertexId || v === wall.endVertexId);
    const twin = kept.findIndex(pair);
    if (twin < 0) { kept.push(wall); continue; }
    // Un tramo de patio que cae sobre un muro real pasa a compartir ese muro: se conserva el visible.
    if (kept[twin]!.hidden && !wall.hidden) kept[twin] = wall;
  }
  const dropped = new Set(doc.walls.filter((wall) => !kept.some((k) => k.id === wall.id)).map((wall) => wall.id));
  return { ...doc, walls: kept, vertices: doc.vertices.filter((v) => v.id !== id),
    openings: doc.openings.filter((opening) => !dropped.has(opening.wallId)) };
}
