import type { EditorDocument, Point } from './schema';
import { EPSILON, pointOnSegment, polygonArea } from './geometry';
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

/** Conflicto geométrico con un punto señalable en el plano. */
export class RoomConflictError extends Error {
  constructor(message: string, readonly point: Point) { super(message); this.name = 'RoomConflictError'; }
}

/** Un tramo que entra y vuelve por el mismo muro (pared colgante dentro de una estancia) no forma parte del contorno. */
function withoutSpurs(boundary: DirectedEdge[]): DirectedEdge[] {
  const edges = [...boundary];
  for (let i = 0; edges.length > 1 && i < edges.length;) {
    const next = (i + 1) % edges.length;
    if (edges[i]!.wallId === edges[next]!.wallId && edges[i]!.from === edges[next]!.to) {
      edges.splice(Math.max(i, next), 1); edges.splice(Math.min(i, next), 1); i = Math.max(0, i - 1);
    } else i++;
  }
  return edges;
}

/** Como deriveRooms, pero nunca lanza: un plano en conflicto se muestra sin suelos en vez de romper el editor. */
export function deriveRoomsSafe(doc: EditorDocument): DerivedRoom[] {
  try { return deriveRooms(doc); } catch { return []; }
}

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
      const outline = withoutSpurs(boundary);
      if (outline.length < 3) continue;
      const points = outline.flatMap((e) => {
        const wall = doc.walls.find((w) => w.id === e.wallId)!, path = wallPath(doc, wall);
        const samples = path.samples();
        return (e.from === wall.startVertexId ? samples : samples.reverse()).slice(0, -1);
      });
      const areaMm2 = polygonArea(points);
      if (areaMm2 <= EPSILON) continue; // Negative orientation is the unbounded exterior.
      const vertexIds = outline.map((e) => e.from);
      // Una cara que pasa dos veces por el mismo vértice (contornos en ocho) no es una estancia fiable.
      if (new Set(vertexIds).size !== vertexIds.length) continue;
      const wallIds = outline.map((e) => e.wallId);
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
      // Cualquier esquina del otro contorno dentro de este (no apoyada en su borde: eso es contacto) es anidamiento.
      const corner = other.vertexIds.map((id) => vertices.get(id)!).find((p) =>
        !polygon.some((a, i) => pointOnSegment(p, a, polygon[(i + 1) % polygon.length]!)) && inside(p, polygon));
      if (corner)
        throw new RoomConflictError(`Contornos anidados: la esquina en (${(corner.x / 1000).toFixed(2)}; ${(corner.y / 1000).toFixed(2)}) m queda dentro de otra estancia`, corner);
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
