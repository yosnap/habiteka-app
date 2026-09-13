import type { Column, EditorDocument, Furniture, Point, Ramp, Stair } from '@/lib/editor-document/schema';
import { localToWorld, type Footprint } from '@/lib/editor-document/spatial-properties';
import { wallPath } from '@/lib/editor-document/wall-path';
import { rampPartFootprint, rampParts } from '@/lib/editor-document/ramp-route';

type Spatial = Furniture | Stair | Ramp | Column;
type Edge = { from: Point; to: Point; sourceId: string; kind: 'wall' | 'object' };
export interface AlignmentGuide { source: Edge; edge: Edge; gapMm: number; }
const GUIDE_RANGE_MM = 2000;

function footprint(item: Footprint): Point[] {
  return [{ x: 0, y: 0 }, { x: item.widthMm, y: 0 }, { x: item.widthMm, y: item.depthMm }, { x: 0, y: item.depthMm }]
    .map((point) => localToWorld(item, point));
}
function edges(points: Point[], sourceId: string, kind: Edge['kind']): Edge[] {
  return points.map((from, index) => ({ from, to: points[(index + 1) % points.length]!, sourceId, kind }));
}
function wallEdges(doc: EditorDocument): Edge[] {
  return doc.walls.filter((wall) => !wall.hidden).flatMap((wall) => {
    const path = wallPath(doc, wall), a = path.at(0), b = path.at(1);
    if (!a || !b) return [];
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    if (length < .001) return [];
    const offset = { x: -dy / length * wall.thicknessMm / 2, y: dx / length * wall.thicknessMm / 2 };
    return [[{ x: a.x + offset.x, y: a.y + offset.y }, { x: b.x + offset.x, y: b.y + offset.y }],
      [{ x: a.x - offset.x, y: a.y - offset.y }, { x: b.x - offset.x, y: b.y - offset.y }]]
      .map(([from, to]) => ({ from: from!, to: to!, sourceId: wall.id, kind: 'wall' as const }));
  });
}
function objectEdges(doc: EditorDocument, selectedId: string): Edge[] {
  const objects: Spatial[] = [...doc.furniture, ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])].filter((item) => item.id !== selectedId);
  return objects.flatMap((item) => 'riseMm' in item
    ? rampParts(item).flatMap((part) => edges(rampPartFootprint(item, part), item.id, 'object'))
    : edges(footprint(item), item.id, 'object'));
}
function project(point: Point, edge: Edge) {
  const dx = edge.to.x - edge.from.x, dy = edge.to.y - edge.from.y, length = Math.hypot(dx, dy);
  if (length < .001) return null;
  const ux = dx / length, uy = dy / length, nx = -uy, ny = ux;
  const along = (point.x - edge.from.x) * ux + (point.y - edge.from.y) * uy;
  return { point: { x: edge.from.x + ux * along, y: edge.from.y + uy * along }, along, length, normal: { x: nx, y: ny } };
}

/** Nearest parallel edge for each side: wall faces and construction-object boundaries. */
export function alignmentGuides(doc: EditorDocument, item: Spatial): AlignmentGuide[] {
  const sourceEdges = edges(footprint(item), item.id, 'object'), targets = [...wallEdges(doc), ...objectEdges(doc, item.id)];
  return sourceEdges.flatMap((source) => {
    const midpoint = { x: (source.from.x + source.to.x) / 2, y: (source.from.y + source.to.y) / 2 };
    const sdx = source.to.x - source.from.x, sdy = source.to.y - source.from.y, slen = Math.hypot(sdx, sdy);
    if (slen < .001) return [];
    const sx = sdx / slen, sy = sdy / slen;
    const candidates = targets.flatMap((edge) => {
      const projection = project(midpoint, edge); if (!projection) return [];
      const ex = (edge.to.x - edge.from.x) / projection.length, ey = (edge.to.y - edge.from.y) / projection.length;
      if (Math.abs(sx * ex + sy * ey) < .995 || projection.along < -100 || projection.along > projection.length + 100) return [];
      const gapMm = Math.hypot(midpoint.x - projection.point.x, midpoint.y - projection.point.y);
      return gapMm <= GUIDE_RANGE_MM ? [{ source, edge, gapMm }] : [];
    }).sort((a, b) => a.gapMm - b.gapMm);
    // One closest face per object/wall, then retain two references per side:
    // a ramp edge and a wall edge can both be relevant to the same landing.
    const uniqueSources = new Map<string, AlignmentGuide>();
    candidates.forEach((candidate) => {
      if (!uniqueSources.has(candidate.edge.sourceId)) uniqueSources.set(candidate.edge.sourceId, candidate);
    });
    return [...uniqueSources.values()].slice(0, 2);
  });
}
