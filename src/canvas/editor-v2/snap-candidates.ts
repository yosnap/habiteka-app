import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { distance } from '@/lib/editor-document/geometry';
import { findWallExtension, type WallExtension } from './wall-extension';
import { wallPath } from '@/lib/editor-document/wall-path';

export interface SnapCandidate { point: Point; kind: 'vertex' | 'wall' | 'orthogonal' | 'extension' | 'free'; id?: string; extension?: WallExtension }
/** Distances are measured in screen pixels, so magnetic reach does not grow when zooming in. */
export function snapWallPoint(doc: EditorDocument, point: Point, scale: number, enabled: boolean, anchor?: Point): SnapCandidate {
  if (!enabled) return { point, kind: 'free' };
  const radius = 12 / Math.max(.001, scale);
  const candidates: (SnapCandidate & { gap: number; priority: number })[] = [];
  for (const v of doc.vertices) candidates.push({ point: { x: v.x, y: v.y }, kind: 'vertex', id: v.id, gap: distance(point, v), priority: 0 });
  for (const wall of doc.walls) {
    const path = wallPath(doc, wall), projected = path.at(path.project(point));
    candidates.push({ point: projected, kind: 'wall', id: wall.id, gap: distance(point, projected), priority: 1 });
  }
  // Corners win over their incident wall projection: otherwise a near-corner click creates a tiny split instead of closing.
  const nearest = candidates.filter((c) => c.gap <= radius).sort((a, b) => a.priority - b.priority || a.gap - b.gap || (a.id ?? '').localeCompare(b.id ?? ''))[0];
  if (nearest) return nearest;
  if (anchor) {
    const extension = findWallExtension(doc, anchor, point, radius);
    if (extension) return { kind: 'extension', point: extension.point, id: extension.wallId, extension };
    const dx = Math.abs(point.x - anchor.x), dy = Math.abs(point.y - anchor.y);
    if (Math.min(dx, dy) <= radius) return { kind: 'orthogonal', point: dx < dy ? { x: anchor.x, y: point.y } : { x: point.x, y: anchor.y } };
  }
  return { point, kind: 'free' };
}
