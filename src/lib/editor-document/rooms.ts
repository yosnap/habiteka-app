import type { EditorDocument, Point } from './schema';
import { EPSILON, polygonArea } from './geometry';
import { assertEditorDocument } from './validation';
import { roomGraph, type DirectedEdge } from './room-graph';
import { wallPath } from './wall-path';

export interface DerivedRoom {
  id: string;
  vertexIds: string[];
  wallIds: string[];
  areaMm2: number;
  boundary: Point[];
}
const edgeKey = (e: DirectedEdge) => JSON.stringify([e.wallId, e.from]);

/** Enumerates bounded faces by walking half-edges, not arbitrary graph cycles. */
export function deriveRooms(doc: EditorDocument): DerivedRoom[] {
  assertEditorDocument(doc);
  const graph = roomGraph(doc);
  const visited = new Set<string>();
  const vertices = new Map(doc.vertices.map((v) => [v.id, v]));
  const rooms: DerivedRoom[] = [];
  for (const outgoing of graph.values())
    for (const start of outgoing) {
      if (visited.has(edgeKey(start))) continue;
      const boundary: DirectedEdge[] = [];
      let edge = start;
      while (!visited.has(edgeKey(edge))) {
        visited.add(edgeKey(edge));
        boundary.push(edge);
        const next = graph.get(edge.to)!;
        const reverse = next.findIndex((e) => e.wallId === edge.wallId);
        edge = next[(reverse - 1 + next.length) % next.length]!;
      }
      if (edgeKey(edge) !== edgeKey(start)) throw new Error('Contorno topológico inconsistente');
      const points = boundary.flatMap((e) => {
        const wall = doc.walls.find((w) => w.id === e.wallId)!, path = wallPath(doc, wall);
        const samples = path.samples();
        return (e.from === wall.startVertexId ? samples : samples.reverse()).slice(0, -1);
      });
      const areaMm2 = polygonArea(points);
      if (areaMm2 <= EPSILON) continue; // Negative orientation is the unbounded exterior.
      const vertexIds = boundary.map((e) => e.from);
      if (new Set(vertexIds).size !== vertexIds.length)
        throw new Error('Habitación con contorno ambiguo');
      const wallIds = boundary.map((e) => e.wallId);
      rooms.push({
        id: `room:${JSON.stringify([...wallIds].sort())}`,
        vertexIds,
        wallIds,
        areaMm2,
        boundary: points,
      });
    }
  // Nested disconnected boundaries require a holes contract; do not double-count area.
  for (const room of rooms)
    for (const other of rooms) {
      if (room === other || room.vertexIds.some((id) => other.vertexIds.includes(id))) continue;
      const polygon = room.boundary;
      if (inside(vertices.get(other.vertexIds[0]!)!, polygon))
        throw new Error('Contornos anidados requieren revisión manual');
    }
  return rooms.sort((a, b) => a.id.localeCompare(b.id));
}

function inside(point: Point, polygon: Point[]): boolean {
  let contained = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      contained = !contained;
  }
  return contained;
}
