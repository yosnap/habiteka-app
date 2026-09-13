import type { EditorDocument, Point, Wall } from '@/lib/editor-document/schema';
import { cross, distance, wallPoints } from '@/lib/editor-document/geometry';
import { wallPath } from '@/lib/editor-document/wall-path';

/**
 * Returns the four corners of a straight wall after cutting its connected ends
 * along the angle bisector. Rendering a wide Line only gives every segment a
 * square cap; a real wall joint needs the two wall faces to meet on the same
 * diagonal instead.
 */
export function wallMiterPolygon(doc: EditorDocument, wall: Wall): Point[] | null {
  if (wall.curveHeightMm) return null;
  const [start, end] = wallPoints(doc, wall);
  const length = distance(start, end);
  if (length < .001) return null;
  const direction = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  const normal = { x: -direction.y, y: direction.x };
  const half = wall.thicknessMm / 2;
  const corners = [
    { x: start.x + normal.x * half, y: start.y + normal.y * half },
    { x: end.x + normal.x * half, y: end.y + normal.y * half },
    { x: end.x - normal.x * half, y: end.y - normal.y * half },
    { x: start.x - normal.x * half, y: start.y - normal.y * half },
  ];
  const startCut = miterCut(doc, wall, wall.startVertexId, start, end, half);
  const endCut = miterCut(doc, wall, wall.endVertexId, end, start, half);
  if (!startCut && !endCut) return null;
  return [
    startCut ? cutCorner(start, direction, normal, half, startCut, 1) : corners[0]!,
    endCut ? cutCorner(end, direction, normal, half, endCut, 1) : corners[1]!,
    endCut ? cutCorner(end, direction, normal, half, endCut, -1) : corners[2]!,
    startCut ? cutCorner(start, direction, normal, half, startCut, -1) : corners[3]!,
  ];
}

function miterCut(doc: EditorDocument, wall: Wall, vertexId: string, vertex: Point, opposite: Point, half: number): Point | null {
  const adjacent = doc.walls.filter((candidate) => candidate.id !== wall.id && !candidate.curveHeightMm &&
    (candidate.startVertexId === vertexId || candidate.endVertexId === vertexId));
  // A T or a multi-wall node remains a filled structural junction. There is no
  // single diagonal that represents those intersections correctly.
  if (adjacent.length !== 1) return null;
  const [otherStart, otherEnd] = wallPoints(doc, adjacent[0]!);
  const otherOpposite = samePoint(otherStart, vertex) ? otherEnd : otherStart;
  const own = unitVector(vertex, opposite), other = unitVector(vertex, otherOpposite);
  const bisector = unitVector({ x: 0, y: 0 }, { x: own.x + other.x, y: own.y + other.y });
  if (!Number.isFinite(bisector.x) || Math.hypot(own.x + other.x, own.y + other.y) < .01) return null;
  // Acute angles create impractically long miters. Keep the existing bevel
  // behavior in that case rather than generating a spike across the plan.
  const reach = half / Math.max(.01, Math.abs(own.x * bisector.y - own.y * bisector.x));
  return reach <= 4 * half ? bisector : null;
}

function cutCorner(vertex: Point, direction: Point, normal: Point, half: number, bisector: Point, side: number): Point {
  const offset = side * half;
  const denominator = direction.x * bisector.y - direction.y * bisector.x;
  const amount = denominator === 0 ? 0 : (-normal.x * offset * bisector.y + normal.y * offset * bisector.x) / denominator;
  return { x: vertex.x + direction.x * amount + normal.x * offset, y: vertex.y + direction.y * amount + normal.y * offset };
}

function unitVector(from: Point, to: Point): Point {
  const length = distance(from, to);
  return length ? { x: (to.x - from.x) / length, y: (to.y - from.y) / length } : { x: NaN, y: NaN };
}

function samePoint(a: Point, b: Point) { return distance(a, b) < .001; }

/** Fill shared-vertex joins, with a bevel when an acute miter exceeds four half-widths. */
export function wallJunctions(doc: EditorDocument): Array<{ id: string; points: Point[] }> {
  return doc.vertices.flatMap((vertex) => {
    const rays = doc.walls.filter((w) => w.startVertexId === vertex.id || w.endVertexId === vertex.id)
      .map((w) => {
        const start = w.startVertexId === vertex.id, t = wallPath(doc, w).tangent(start ? 0 : 1), sign = start ? 1 : -1;
        return { x: t.x * sign, y: t.y * sign, half: w.thicknessMm / 2 };
      }).filter((r) => Number.isFinite(r.x) && Number.isFinite(r.y))
      .sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
    if (rays.length < 2) return [];
    const points: Point[] = rays.flatMap((r) => [
      { x: vertex.x - r.y * r.half, y: vertex.y + r.x * r.half },
      { x: vertex.x + r.y * r.half, y: vertex.y - r.x * r.half },
    ]);
    rays.forEach((a, i) => {
      const b = rays[(i + 1) % rays.length]!, denominator = a.x * b.y - a.y * b.x;
      if (Math.abs(denominator) < 1e-7) return;
      const p = { x: vertex.x - a.y * a.half, y: vertex.y + a.x * a.half };
      const q = { x: vertex.x + b.y * b.half, y: vertex.y - b.x * b.half };
      const t = ((q.x - p.x) * b.y - (q.y - p.y) * b.x) / denominator;
      const intersection = { x: p.x + a.x * t, y: p.y + a.y * t };
      if (distance(vertex, intersection) <= 4 * Math.max(a.half, b.half)) points.push(intersection);
    });
    return [{ id: vertex.id, points: hull(points) }];
  });
}

function hull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (input: Point[]) => {
    const result: Point[] = [];
    for (const point of input) {
      while (result.length > 1 && cross(result[result.length - 2]!, result.at(-1)!, point) <= 0) result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}
