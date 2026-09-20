import type { EditorDocument, Point, Wall } from '@/lib/editor-document/schema';
import { wallPoints } from '@/lib/editor-document/geometry';
import { alignPoints, type MagneticGuide } from './magnetic-alignment';
export interface WallMoveSnap { delta: Point; guides: MagneticGuide[]; }
export function snapWallMove(doc: EditorDocument, wall: Wall, rawDelta: Point, scale: number, enabled: boolean): WallMoveSnap {
  if (!enabled) return { delta: rawDelta, guides: [] };
  const [a, b] = wallPoints(doc, wall);
  const grid = { x: Math.round((a.x + rawDelta.x) / 100) * 100 - a.x, y: Math.round((a.y + rawDelta.y) / 100) * 100 - a.y };
  const points = [a, b, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }].map((p) => ({ x: p.x + grid.x, y: p.y + grid.y }));
  const incident = doc.walls.filter((w) => [wall.startVertexId, wall.endVertexId].includes(w.startVertexId) || [wall.startVertexId, wall.endVertexId].includes(w.endVertexId)).map((w) => w.id);
  const result = alignPoints(doc, points, scale, enabled, incident);
  return { delta: { x: grid.x + result.delta.x, y: grid.y + result.delta.y }, guides: result.guides };
}
