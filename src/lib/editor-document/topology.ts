import type { EditorDocument } from './schema';
import { cross, distance, EPSILON, pointOnSegment, wallPoints } from './geometry';
import { linearWallGeometry } from './wall-path';
import { wallConstruction } from './construction-properties';

/** Crossings must be explicitly split into a shared vertex, never guessed by rooms. */
export function assertPlanarTopology(doc: EditorDocument): void {
  const structuralWalls = doc.walls.filter((wall) => wallConstruction(wall).heightMm > 1500);
  // Muretes are guards, not room boundaries. They may meet a raised wall or
  // landing edge without being split into the floor-plan topology.
  if (structuralWalls.some((w) => w.curveHeightMm)) {
    const linear = linearWallGeometry(doc);
    return assertPlanarTopology({ ...linear, walls: linear.walls.filter((wall) => wallConstruction(wall).heightMm > 1500) });
  }
  // Endpoint lookup once avoids an O(vertices) scan inside every wall pair.
  const points = new Map(structuralWalls.map((w) => [w.id, wallPoints(doc, w)]));
  const vertices = new Map(doc.vertices.map((v) => [v.id, v]));
  for (let i = 0; i < structuralWalls.length; i++) {
    const w = structuralWalls[i]!;
    const [a, b] = points.get(w.id)!;
    for (const v of structuralWalls.slice(i + 1)) {
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
  const structuralVertices = new Set(structuralWalls.flatMap((wall) => [wall.startVertexId, wall.endVertexId]));
  const verticesInTopology = doc.vertices.filter((vertex) => structuralVertices.has(vertex.id));
  for (let i = 0; i < verticesInTopology.length; i++) {
    if (verticesInTopology.slice(i + 1).some((v) => distance(v, verticesInTopology[i]!) <= EPSILON)) {
      throw new Error('Vértices coincidentes deben compartir un ID');
    }
  }
}
