import type { EditorDocument, Point, Wall } from './schema';
import { distance, interpolate, wallPoints } from './geometry';

export function wallPath(doc: EditorDocument, wall: Wall) {
  const [a, b] = wallPoints(doc, wall), chord = distance(a, b), h = wall.curveHeightMm ?? 0;
  const ux = (b.x - a.x) / chord, uy = (b.y - a.y) / chord;
  const sweep = Math.abs(h) < .001 ? 0 : -4 * Math.atan(2 * h / chord);
  const k = sweep ? h / 2 - chord * chord / (8 * h) : 0;
  const center = { x: (a.x + b.x) / 2 - uy * k, y: (a.y + b.y) / 2 + ux * k };
  const radius = sweep ? Math.hypot(chord / 2, k) : Infinity;
  const at = (t: number): Point => {
    if (!sweep) return interpolate(a, b, t);
    if (t === 0) return { ...a }; if (t === 1) return { ...b };
    const angle = sweep * t, x = a.x - center.x, y = a.y - center.y;
    return { x: center.x + x * Math.cos(angle) - y * Math.sin(angle), y: center.y + x * Math.sin(angle) + y * Math.cos(angle) };
  };
  const tangent = (t: number): Point => {
    if (!sweep) return { x: ux, y: uy };
    const p = at(t), direction = Math.sign(sweep);
    return { x: -(p.y - center.y) / radius * direction, y: (p.x - center.x) / radius * direction };
  };
  const samples = (from = 0, to = 1) => {
    const count = sweep ? Math.max(1, Math.ceil(Math.abs(sweep * (to - from)) / Math.min(Math.PI / 90, 2 * Math.acos(Math.max(-1, 1 - 1 / radius))))) : 1;
    return Array.from({ length: Math.min(512, count) + 1 }, (_, i) => at(from + (to - from) * i / Math.min(512, count)));
  };
  const project = (p: Point) => {
    if (!sweep) return Math.max(0, Math.min(1, ((p.x - a.x) * ux + (p.y - a.y) * uy) / chord));
    const start = Math.atan2(a.y - center.y, a.x - center.x), angle = Math.atan2(p.y - center.y, p.x - center.x);
    const candidates = [-2, -1, 0, 1, 2].map((n) => Math.max(0, Math.min(1, (angle - start + n * Math.PI * 2) / sweep)));
    return candidates.sort((x, y) => distance(p, at(x)) - distance(p, at(y)))[0]!;
  };
  return { at, tangent, samples, project, length: sweep ? Math.abs(sweep) * radius : chord, sweep, radius, chord, center };
}
export function wallStrip(doc: EditorDocument, wall: Wall, from = 0, to = 1): Point[] {
  const path = wallPath(doc, wall), points = path.samples(from, to), half = wall.thicknessMm / 2;
  const side = (sign: number) => points.map((p, i) => {
    const t = path.tangent(from + (to - from) * i / (points.length - 1));
    return { x: p.x - t.y * half * sign, y: p.y + t.x * half * sign };
  });
  return [...side(1), ...side(-1).reverse()];
}
/** Transient tessellation for intersection checks, never persisted as fake walls. */
export function linearWallGeometry(doc: EditorDocument): EditorDocument {
  if (!doc.walls.some((w) => w.curveHeightMm)) return doc;
  const vertices = [...doc.vertices];
  const walls = doc.walls.flatMap((wall) => {
    if (!wall.curveHeightMm) return [wall];
    const samples = wallPath(doc, wall).samples(), ids = samples.map((p, i) => {
      if (!i) return wall.startVertexId; if (i === samples.length - 1) return wall.endVertexId;
      const id = `curve:${wall.id}:${i}`; vertices.push({ ...p, id }); return id;
    });
    return ids.slice(1).map((id, i) => ({ ...wall, curveHeightMm: undefined, id: `${wall.id}:piece:${i}`, startVertexId: ids[i]!, endVertexId: id }));
  });
  return { ...doc, vertices, walls };
}
