import { isBoundary, isLegacyBoundary } from '@/lib/editor-document/boundary-types';
import { wallPoints } from '@/lib/editor-document/geometry';
import type { EditorDocument, Furniture, Point, Wall } from '@/lib/editor-document/schema';
import { footprint, objectCenter } from '@/lib/editor-document/spatial-properties';
import { wallPath } from '@/lib/editor-document/wall-path';

/** Una bañera importada puede solapar la cara unos centímetros; esa posición sigue siendo un apoyo. */
const MAX_OVERLAP_MM = 200;
const MAX_GAP_MM = 50;

function rigidTranslation(before: EditorDocument, after: EditorDocument, wall: Wall): Point | null {
  const next = after.walls.find((item) => item.id === wall.id);
  if (!next || wall.hidden || next.hidden) return null;
  const [a, b] = wallPoints(before, wall), [c, d] = wallPoints(after, next);
  const start = { x: c.x - a.x, y: c.y - a.y }, end = { x: d.x - b.x, y: d.y - b.y };
  if (Math.hypot(start.x, start.y) < .5 || Math.hypot(start.x - end.x, start.y - end.y) > .5) return null;
  return start;
}

function faceGap(doc: EditorDocument, wall: Wall, item: Furniture): { gap: number; normal: Point } | null {
  const path = wallPath(doc, wall), center = objectCenter(item), t = path.project(center);
  const point = path.at(wall.curveHeightMm ? t : 0), tangent = path.tangent(t);
  const corners = footprint(item);
  if (!wall.curveHeightMm) {
    const along = corners.map((corner) => (corner.x - point.x) * tangent.x + (corner.y - point.y) * tangent.y);
    if (Math.max(...along) < 0 || Math.min(...along) > path.length) return null;
  }
  const signed = (center.x - point.x) * -tangent.y + (center.y - point.y) * tangent.x;
  if (Math.abs(signed) < Math.max(20, wall.thicknessMm / 2 - 25)) return null;
  const side = signed >= 0 ? 1 : -1;
  const gap = Math.min(...corners.map((corner) =>
    ((corner.x - point.x) * -tangent.y + (corner.y - point.y) * tangent.x) * side)) - wall.thicknessMm / 2;
  return gap >= -MAX_OVERLAP_MM && gap <= MAX_GAP_MM
    ? { gap, normal: { x: -tangent.y * side, y: tangent.x * side } } : null;
}

/** Sigue solo muros que se trasladaron completos; un vértice estirado no arrastra muebles de otros tabiques. */
export function followFurnitureOnMovedWalls(source: EditorDocument, candidate: EditorDocument, wallIds: string[]): EditorDocument {
  const moved = source.walls.filter((wall) => wallIds.includes(wall.id)).flatMap((wall) => {
    const delta = rigidTranslation(source, candidate, wall);
    return delta ? [{ wall, delta }] : [];
  });
  if (!moved.length) return candidate;
  const oldObjects = new Map([...source.furniture, ...(source.kitchenRuns ?? [])].map((item) => [item.id, item]));
  const objects = [...candidate.furniture, ...(candidate.kitchenRuns ?? [])];
  const byId = new Map(objects.map((item) => [item.id, item]));
  const shifted = new Set<string>();
  for (const item of objects) {
    if (item.hostId || isBoundary(item) || isLegacyBoundary(item)) continue;
    const old = oldObjects.get(item.id);
    if (!old || Math.hypot(item.x - old.x, item.y - old.y) > .5) continue;
    const nearest = moved.map(({ wall, delta }) => ({ face: faceGap(source, wall, old), delta }))
      .filter((hit): hit is { face: { gap: number; normal: Point }; delta: Point } => hit.face !== null)
      .sort((a, b) => Math.abs(a.face.gap) - Math.abs(b.face.gap))[0];
    if (!nearest) continue;
    const release = Math.max(0, -nearest.face.gap);
    item.x += nearest.delta.x + nearest.face.normal.x * release;
    item.y += nearest.delta.y + nearest.face.normal.y * release;
    shifted.add(item.id);
  }
  // Lámparas y objetos sobre muebles conservan la misma posición relativa a su anfitrión.
  const visited = new Set<string>();
  const followHost = (item: Furniture, visiting = new Set<string>()): void => {
    if (visited.has(item.id) || visiting.has(item.id)) return;
    visiting.add(item.id);
    const oldItem = oldObjects.get(item.id);
    if (!oldItem || Math.hypot(item.x - oldItem.x, item.y - oldItem.y) > .5) {
      visited.add(item.id); visiting.delete(item.id); return;
    }
    const host = item.hostId && byId.get(item.hostId), oldHost = item.hostId && oldObjects.get(item.hostId);
    if (host && oldHost) {
      if (host.hostId) followHost(host, visiting);
      if (shifted.has(host.id)) {
        item.x += host.x - oldHost.x;
        item.y += host.y - oldHost.y;
        shifted.add(item.id);
      }
    }
    visited.add(item.id);
    visiting.delete(item.id);
  };
  for (const item of candidate.furniture) if (item.hostId) followHost(item);
  return candidate;
}
