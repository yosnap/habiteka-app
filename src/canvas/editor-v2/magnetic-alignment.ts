import { planObjects } from '@/lib/editor-document/boundary-types';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { localToWorld, type Footprint } from '@/lib/editor-document/spatial-properties';
import { wallPath } from '@/lib/editor-document/wall-path';
import { deriveRooms } from '@/lib/editor-document/rooms';

export type MagneticGuide = { from: Point; to: Point };
export function footprintAnchors(item: Footprint): Point[] {
  return [0, .5, 1].flatMap((x) => [0, .5, 1].map((y) => localToWorld(item, { x: x * item.widthMm, y: y * item.depthMm })));
}
export function magneticReferences(doc: EditorDocument, exclude: string[] = []): Point[] {
  const excluded = new Set(exclude);
  const points = doc.walls.filter((w) => !excluded.has(w.id)).flatMap((wall) => {
    const path = wallPath(doc, wall);
    return [0, .5, 1].flatMap((t) => {
      const p = path.at(t), n = path.tangent(t), half = wall.hidden ? 0 : wall.thicknessMm / 2;
      return [-1, 0, 1].map((side) => ({ x: p.x - n.y * half * side, y: p.y + n.x * half * side }));
    });
  });
  for (const item of [...planObjects(doc), ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])])
    if (!excluded.has(item.id)) points.push(...footprintAnchors(item));
  for (const boundary of doc.boundaries ?? []) if (!excluded.has(boundary.id))
    for (const gate of boundary.construction.gates) if (!excluded.has(gate.id))
      points.push(...[-.5, 0, .5].map((side) => localToWorld(boundary, { x: gate.positionMm + side * gate.widthMm, y: boundary.depthMm / 2 })));
  for (const run of doc.kitchenRuns ?? []) if (!excluded.has(run.id))
    for (const slot of run.kitchen.slots) if (!excluded.has(slot.id))
      points.push(...[-.5, 0, .5].map((side) => localToWorld(run, { x: slot.positionMm + side * slot.widthMm, y: 0 })));
  for (const opening of doc.openings) {
    if (excluded.has(opening.id) || excluded.has(opening.wallId)) continue;
    const wall = doc.walls.find((w) => w.id === opening.wallId); if (!wall) continue;
    const path = wallPath(doc, wall);
    points.push(...[-.5, 0, .5].map((side) => path.at(opening.position + side * opening.widthMm / path.length)));
  }
  for (const point of [...doc.labels, ...(doc.luminaires ?? []), ...(doc.walkthroughs ?? []).flatMap((r) => r.waypoints)])
    if (!excluded.has(point.id)) points.push(point);
  try { for (const room of deriveRooms(doc)) if (!room.wallIds.some((id) => excluded.has(id))) {
    points.push({ x: room.boundary.reduce((sum, p) => sum + p.x, 0) / room.boundary.length, y: room.boundary.reduce((sum, p) => sum + p.y, 0) / room.boundary.length });
  } } catch { /* Un borrador incompleto conserva imanes de entidades sin exigir recintos válidos. */ }
  for (const dimension of doc.dimensions) if (!excluded.has(dimension.id)) points.push(dimension.from, dimension.to,
    { x: (dimension.from.x + dimension.to.x) / 2, y: (dimension.from.y + dimension.to.y) / 2 });
  return points;
}
/** Ejes, centros y extremos comparten el mismo alcance de 10 píxeles a cualquier zoom. */
export function alignPoints(doc: EditorDocument, moving: Point[], scale: number, enabled: boolean, exclude: string[] = []) {
  const delta = { x: 0, y: 0 }, guides: MagneticGuide[] = [];
  if (!enabled || !moving.length) return { delta, guides };
  const targets = magneticReferences(doc, exclude), tolerance = 10 / Math.max(.001, scale);
  for (const axis of ['x', 'y'] as const) {
    let best: { source: Point; target: Point; gap: number } | undefined;
    for (const source of moving) for (const target of targets) {
      const gap = target[axis] - source[axis];
      if (Math.abs(gap) <= tolerance && (!best || Math.abs(gap) < Math.abs(best.gap))) best = { source, target, gap };
    }
    if (!best) continue;
    delta[axis] = best.gap;
    const other = axis === 'x' ? 'y' : 'x', pad = 30 / Math.max(.001, scale);
    const from = { ...best.target }, to = { ...best.target };
    from[other] = Math.min(best.source[other], best.target[other]) - pad;
    to[other] = Math.max(best.source[other], best.target[other]) + pad;
    guides.push({ from, to });
  }
  return { delta, guides };
}
export function alignPoint(doc: EditorDocument, point: Point, scale: number, enabled: boolean, exclude: string[] = []) {
  const result = alignPoints(doc, [point], scale, enabled, exclude);
  return { ...result, point: { x: point.x + result.delta.x, y: point.y + result.delta.y } };
}
export function alignRoom(doc: EditorDocument, roomId: string, raw: Point, scale: number, enabled: boolean) {
  const room = deriveRooms(doc).find((r) => r.id === roomId);
  if (!room) return { delta: raw, guides: [] };
  const minX = Math.min(...room.boundary.map((p) => p.x)), maxX = Math.max(...room.boundary.map((p) => p.x));
  const minY = Math.min(...room.boundary.map((p) => p.y)), maxY = Math.max(...room.boundary.map((p) => p.y));
  // Todos los vértices del contorno (no solo la caja): las muescas de una terraza también se pegan a la casa.
  const anchors = [...room.boundary, { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }].map((p) => ({ x: p.x + raw.x, y: p.y + raw.y }));
  const result = alignPoints(doc, anchors, scale, enabled, [...room.wallIds, ...doc.labels.filter((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY).map((p) => p.id)]);
  return { ...result, delta: { x: raw.x + result.delta.x, y: raw.y + result.delta.y } };
}
