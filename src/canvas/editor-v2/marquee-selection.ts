import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { footprint } from './spatial-placement';
import { wallStrip, wallPath } from '@/lib/editor-document/wall-path';
import { rampPartFootprint, rampParts } from '@/lib/editor-document/ramp-route';

interface Rectangle { left: number; right: number; top: number; bottom: number }

function rectangle(from: Point, to: Point): Rectangle {
  return { left: Math.min(from.x, to.x), right: Math.max(from.x, to.x), top: Math.min(from.y, to.y), bottom: Math.max(from.y, to.y) };
}

function contains(rect: Rectangle, points: Point[]): boolean {
  return points.length > 0 && points.every((point) => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom);
}

function openingFootprint(doc: EditorDocument, openingId: string): Point[] {
  const opening = doc.openings.find((item) => item.id === openingId);
  const wall = opening && doc.walls.find((item) => item.id === opening.wallId);
  if (!opening || !wall) return [];
  const path = wallPath(doc, wall), half = opening.widthMm / path.length / 2;
  const from = Math.max(0, opening.position - half), to = Math.min(1, opening.position + half), thickness = wall.thicknessMm / 2;
  const points = path.samples(from, to);
  const side = (sign: number) => points.map((point, index) => {
    const tangent = path.tangent(from + (to - from) * index / Math.max(1, points.length - 1));
    return { x: point.x - tangent.y * thickness * sign, y: point.y + tangent.x * thickness * sign };
  });
  return [...side(1), ...side(-1)];
}

/** IDs that can be selected and deleted directly; rooms are derived, never entities. */
export function selectableEntityIds(doc: EditorDocument): string[] {
  return [...doc.walls, ...doc.openings, ...doc.furniture, ...doc.labels, ...doc.dimensions, ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])].map((item) => item.id);
}

/** Select only entities whose full 2D footprint lies within the dragged frame. */
export function selectEntitiesInRectangle(doc: EditorDocument, from: Point, to: Point): string[] {
  const rect = rectangle(from, to), ids: string[] = [];
  for (const wall of doc.walls) if (contains(rect, wallStrip(doc, wall))) ids.push(wall.id);
  for (const opening of doc.openings) if (contains(rect, openingFootprint(doc, opening.id))) ids.push(opening.id);
  for (const item of [...doc.furniture, ...(doc.stairs ?? [])]) if (contains(rect, footprint(item))) ids.push(item.id);
  for (const column of doc.columns ?? []) if (contains(rect, footprint(column))) ids.push(column.id);
  for (const ramp of doc.ramps ?? []) if (rampParts(ramp).every((part) => contains(rect, rampPartFootprint(ramp, part)))) ids.push(ramp.id);
  for (const label of doc.labels) if (contains(rect, [label])) ids.push(label.id);
  for (const dimension of doc.dimensions) if (contains(rect, [dimension.from, dimension.to])) ids.push(dimension.id);
  return ids;
}
