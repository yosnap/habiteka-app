import type { EditorDocument, Point, Wall } from './schema';

export const EPSILON = 1e-7;
export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
export const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export const interpolate = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export function wallPoints(doc: EditorDocument, wall: Wall): [Point, Point] {
  const a = doc.vertices.find((v) => v.id === wall.startVertexId);
  const b = doc.vertices.find((v) => v.id === wall.endVertexId);
  if (!a || !b) throw new Error('Muro con referencia de vértice inexistente');
  return [a, b];
}
export function polygonArea(points: Point[]): number {
  return (
    points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length]!;
      return sum + p.x * q.y - q.x * p.y;
    }, 0) / 2
  );
}
export function pointOnSegment(p: Point, a: Point, b: Point): boolean {
  return (
    Math.abs(cross(a, b, p)) <= EPSILON * Math.max(1, distance(a, b)) &&
    p.x >= Math.min(a.x, b.x) - EPSILON &&
    p.x <= Math.max(a.x, b.x) + EPSILON &&
    p.y >= Math.min(a.y, b.y) - EPSILON &&
    p.y <= Math.max(a.y, b.y) + EPSILON
  );
}
