import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { distance, wallPoints } from '@/lib/editor-document/geometry';

export interface WallExtension {
  wallId: string;
  vertexId: string;
  from: Point;
  point: Point;
}

/** Only extend a free end in the current chain; never move a shared corner. */
export function findWallExtension(doc: EditorDocument, anchor: Point, pointer: Point, radius: number): WallExtension | null {
  const root = doc.vertices.find((v) => distance(v, anchor) < .01);
  if (!root) return null;
  const connected = new Set([root.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const wall of doc.walls) {
      if (connected.has(wall.startVertexId) === connected.has(wall.endVertexId)) continue;
      connected.add(wall.startVertexId); connected.add(wall.endVertexId); changed = true;
    }
  }
  const candidates: WallExtension[] = [];
  for (const wall of doc.walls) {
    if (wall.curveHeightMm) continue;
    const [a, b] = wallPoints(doc, wall);
    for (const atStart of [true, false]) {
      const vertexId = atStart ? wall.startVertexId : wall.endVertexId;
      if (vertexId === root.id || !connected.has(vertexId)) continue;
      if (doc.walls.filter((w) => w.startVertexId === vertexId || w.endVertexId === vertexId).length !== 1) continue;
      const end = atStart ? a : b, other = atStart ? b : a;
      const dx = end.x - other.x, dy = end.y - other.y;
      for (const axis of ['x', 'y'] as const) {
        const direction = axis === 'x' ? dx : dy;
        if (Math.abs(direction) < 1e-7) continue;
        const t = (anchor[axis] - end[axis]) / direction;
        if (t <= 1e-7) continue;
        const point = { x: end.x + t * dx, y: end.y + t * dy };
        if (distance(point, pointer) > radius || distance(point, anchor) < 50) continue;
        candidates.push({ wallId: wall.id, vertexId, from: { ...end }, point });
      }
    }
  }
  return candidates.sort((a, b) => distance(a.point, pointer) - distance(b.point, pointer) || a.wallId.localeCompare(b.wallId))[0] ?? null;
}

/** Preserve physical placement when normalized host coordinates change length/origin. */
export function applyWallExtension(doc: EditorDocument, extension: WallExtension): EditorDocument {
  const next = structuredClone(doc);
  const wall = next.walls.find((w) => w.id === extension.wallId);
  const vertex = next.vertices.find((v) => v.id === extension.vertexId);
  if (!wall || !vertex || distance(vertex, extension.from) > .01 ||
    ![wall.startVertexId, wall.endVertexId].includes(vertex.id) ||
    next.walls.filter((w) => w.startVertexId === vertex.id || w.endVertexId === vertex.id).length !== 1)
    throw new Error('La pared cambió durante el cierre. Vuelve a señalar la unión.');
  const [a, b] = wallPoints(next, wall), oldLength = distance(a, b);
  const oldStart = { ...a };
  Object.assign(vertex, extension.point);
  const [start, end] = wallPoints(next, wall), length = distance(start, end);
  const offset = ((oldStart.x - start.x) * (end.x - start.x) + (oldStart.y - start.y) * (end.y - start.y)) / length;
  for (const opening of next.openings.filter((o) => o.wallId === wall.id))
    opening.position = (offset + opening.position * oldLength) / length;
  for (const comment of next.comments?.filter((c) => c.targetEntityId === wall.id) ?? [])
    comment.anchor.x = (offset + comment.anchor.x * oldLength) / length;
  return next;
}
