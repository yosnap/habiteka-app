import type { EditorDocument, Point, Wall } from '@/lib/editor-document/schema';
import { wallPoints } from '@/lib/editor-document/geometry';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import { rampPartFootprint, rampParts } from '@/lib/editor-document/ramp-route';
import { wallPath } from '@/lib/editor-document/wall-path';

export interface WallMoveSnap { delta: Point; guides: { from: Point; to: Point }[]; }

function corners(item: { x: number; y: number; widthMm: number; depthMm: number; rotation: number }) {
  return [{ x: 0, y: 0 }, { x: item.widthMm, y: 0 }, { x: item.widthMm, y: item.depthMm }, { x: 0, y: item.depthMm }]
    .map((point) => localToWorld(item, point));
}

function referencePoints(doc: EditorDocument, moving: Wall): Point[] {
  const own = new Set([moving.startVertexId, moving.endVertexId]);
  const vertices = doc.vertices.filter((vertex) => !own.has(vertex.id)).map(({ x, y }) => ({ x, y }));
  const faces = doc.walls.filter((wall) => wall.id !== moving.id && !wall.hidden).flatMap((wall) => {
    const path = wallPath(doc, wall), a = path.at(0), b = path.at(path.length), direction = path.tangent(0);
    const normal = { x: -direction.y * wall.thicknessMm / 2, y: direction.x * wall.thicknessMm / 2 };
    return [a, b, { x: a.x + normal.x, y: a.y + normal.y }, { x: b.x + normal.x, y: b.y + normal.y },
      { x: a.x - normal.x, y: a.y - normal.y }, { x: b.x - normal.x, y: b.y - normal.y }];
  });
  const objects = [...doc.furniture, ...(doc.stairs ?? []), ...(doc.columns ?? [])].flatMap(corners);
  const ramps = (doc.ramps ?? []).flatMap((ramp) => rampParts(ramp).flatMap((part) => rampPartFootprint(ramp, part)));
  return [...vertices, ...faces, ...objects, ...ramps];
}

/** Snaps a whole wall by its physical endpoints, never by its transient Konva offset. */
export function snapWallMove(doc: EditorDocument, wall: Wall, rawDelta: Point, scale: number, enabled: boolean): WallMoveSnap {
  const [start, end] = wallPoints(doc, wall);
  if (!enabled) return { delta: rawDelta, guides: [] };
  const snappedGrid = {
    x: Math.round((start.x + rawDelta.x) / 100) * 100 - start.x,
    y: Math.round((start.y + rawDelta.y) / 100) * 100 - start.y,
  };
  const tolerance = Math.max(150, 24 / Math.max(scale, .001)), targets = referencePoints(doc, wall);
  const endpoints = [start, end].map((point) => ({ x: point.x + snappedGrid.x, y: point.y + snappedGrid.y }));
  const nearest = (axis: 'x' | 'y') => endpoints.flatMap((point) => targets.map((target) => ({ point, target,
    gap: Math.abs(point[axis] - target[axis]) }))).filter((candidate) => candidate.gap <= tolerance)
    .sort((a, b) => a.gap - b.gap)[0];
  const x = nearest('x'), y = nearest('y');
  const delta = { x: snappedGrid.x + (x ? x.target.x - x.point.x : 0), y: snappedGrid.y + (y ? y.target.y - y.point.y : 0) };
  const guides = [x && { from: { x: x.point.x, y: start.y + delta.y }, to: { x: x.target.x, y: start.y + delta.y } },
    y && { from: { x: start.x + delta.x, y: y.point.y }, to: { x: start.x + delta.x, y: y.target.y } }].filter(Boolean) as { from: Point; to: Point }[];
  return { delta, guides };
}
