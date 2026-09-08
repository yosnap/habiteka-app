import type { EditorDocument } from './schema';
import { cross, distance, EPSILON, pointOnSegment, wallPoints } from './geometry';
import { linearWallGeometry } from './wall-path';

/** Crossings must be explicitly split into a shared vertex, never guessed by rooms. */
export function assertPlanarTopology(doc: EditorDocument): void {
  if (doc.walls.some((w) => w.curveHeightMm)) return assertPlanarTopology(linearWallGeometry(doc));
  // Endpoint lookup once avoids an O(vertices) scan inside every wall pair.
  const points = new Map(doc.walls.map((w) => [w.id, wallPoints(doc, w)]));
  const vertices = new Map(doc.vertices.map((v) => [v.id, v]));
  for (let i = 0; i < doc.walls.length; i++) {
    const w = doc.walls[i]!;
    const [a, b] = points.get(w.id)!;
    for (const v of doc.walls.slice(i + 1)) {
      const [c, d] = points.get(v.id)!;
      if (Math.max(a.x, b.x) + EPSILON < Math.min(c.x, d.x) || Math.max(c.x, d.x) + EPSILON < Math.min(a.x, b.x) ||
        Math.max(a.y, b.y) + EPSILON < Math.min(c.y, d.y) || Math.max(c.y, d.y) + EPSILON < Math.min(a.y, b.y)) continue;
      const common = [w.startVertexId, w.endVertexId].filter(
        (id) => id === v.startVertexId || id === v.endVertexId,
      );
      if (common.length === 2) throw new Error('Muros duplicados sobre el mismo segmento');
      if (common.length === 1) {
        const s = vertices.get(common[0]!)!;
        const otherA = w.startVertexId === s.id ? b : a;
        const otherB = v.startVertexId === s.id ? d : c;
        if (pointOnSegment(otherA, s, otherB) || pointOnSegment(otherB, s, otherA)) {
          throw new Error('Muros colineales superpuestos');
        }
      } else {
        const proper = cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
        if (
          proper ||
          pointOnSegment(a, c, d) ||
          pointOnSegment(b, c, d) ||
          pointOnSegment(c, a, b) ||
          pointOnSegment(d, a, b)
        ) {
          throw new Error('Intersección de muros sin vértice compartido');
        }
      }
    }
  }
  for (let i = 0; i < doc.vertices.length; i++) {
    if (doc.vertices.slice(i + 1).some((v) => distance(v, doc.vertices[i]!) <= EPSILON)) {
      throw new Error('Vértices coincidentes deben compartir un ID');
    }
  }
}
