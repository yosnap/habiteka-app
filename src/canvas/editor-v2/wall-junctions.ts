import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { cross, distance } from '@/lib/editor-document/geometry';
import { wallPath } from '@/lib/editor-document/wall-path';

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
