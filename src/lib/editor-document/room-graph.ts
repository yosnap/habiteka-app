import type { EditorDocument } from './schema';
import { wallPath } from './wall-path';

export interface DirectedEdge {
  from: string;
  to: string;
  wallId: string;
  angle: number;
}
export function roomGraph(doc: EditorDocument): Map<string, DirectedEdge[]> {
  const graph = new Map<string, DirectedEdge[]>();
  for (const w of doc.walls) {
    for (const [from, to] of [
      [w.startVertexId, w.endVertexId],
      [w.endVertexId, w.startVertexId],
    ] as const) {
      const edges = graph.get(from) ?? [];
      const direction = wallPath(doc, w).tangent(from === w.startVertexId ? 0 : 1), sign = from === w.startVertexId ? 1 : -1;
      edges.push({ from, to, wallId: w.id, angle: Math.atan2(direction.y * sign, direction.x * sign) });
      graph.set(from, edges);
    }
  }
  // A bridge borders the same face twice: omit it, including spurs inside rooms.
  const seen = new Map<string, number>();
  const low = new Map<string, number>();
  const bridges = new Set<string>();
  let clock = 0;
  function visit(id: string, parentWall?: string): void {
    seen.set(id, ++clock);
    low.set(id, clock);
    for (const edge of graph.get(id) ?? []) {
      if (edge.wallId === parentWall) continue;
      if (!seen.has(edge.to)) {
        visit(edge.to, edge.wallId);
        low.set(id, Math.min(low.get(id)!, low.get(edge.to)!));
        if (low.get(edge.to)! > seen.get(id)!) bridges.add(edge.wallId);
      } else low.set(id, Math.min(low.get(id)!, seen.get(edge.to)!));
    }
  }
  for (const id of graph.keys()) if (!seen.has(id)) visit(id);
  for (const [id, edges] of graph)
    graph.set(
      id,
      edges.filter((e) => !bridges.has(e.wallId)).sort((a, b) => a.angle - b.angle),
    );
  return graph;
}
