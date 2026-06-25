/**
 * Detección de rooms a partir de un grafo de WallSegments.
 *
 * Cada WallSegment es una arista entre dos nodos (endpoints). Cuando los
 * endpoints forman un ciclo cerrado, se detecta una sala (DetectedRoom).
 * No se persiste en BD: se recalcula al cargar el doc.
 */
import type { WallSegment, DetectedRoom, Point2D } from './types';

/** Distancia máxima (px) para considerar dos endpoints el mismo nodo. */
const DEFAULT_SNAP_THRESHOLD = 5;

/**
 * Snaps nearby endpoints to a grid of `threshold` px so the adjacency graph
 * is built correctly even when Draw Walls leaves tiny floating-point gaps.
 */
export function snapEndpoints(segments: WallSegment[], threshold: number): WallSegment[] {
  if (threshold <= 0) return segments;
  return segments.map((seg) => ({
    ...seg,
    p1: snapPt(seg.p1, threshold),
    p2: snapPt(seg.p2, threshold),
  }));
}

function snapPt(p: Point2D, threshold: number): Point2D {
  return {
    x: Math.round(p.x / threshold) * threshold,
    y: Math.round(p.y / threshold) * threshold,
  };
}

function nodeKey(p: Point2D): string {
  return `${p.x},${p.y}`;
}

type NodeData = { neighbors: Set<string>; point: Point2D };

function buildAdj(segments: WallSegment[]): Map<string, NodeData> {
  const adj = new Map<string, NodeData>();

  function ensureNode(p: Point2D): void {
    const k = nodeKey(p);
    if (!adj.has(k)) adj.set(k, { neighbors: new Set(), point: p });
  }

  for (const seg of segments) {
    ensureNode(seg.p1);
    ensureNode(seg.p2);
    const k1 = nodeKey(seg.p1);
    const k2 = nodeKey(seg.p2);
    if (k1 === k2) continue; // degenerate segment, skip
    adj.get(k1)!.neighbors.add(k2);
    adj.get(k2)!.neighbors.add(k1);
  }

  return adj;
}

/**
 * DFS-based cycle finder for simple undirected graphs.
 * Each back edge found during DFS corresponds to one independent cycle.
 * For planar floor-plan graphs: #cycles = edges − nodes + components.
 */
function findCycles(adj: Map<string, NodeData>): string[][] {
  const result: string[][] = [];
  const visited = new Set<string>();

  function dfs(node: string, parentNode: string | null, path: string[]): void {
    visited.add(node);
    path.push(node);

    for (const neighbor of adj.get(node)!.neighbors) {
      if (neighbor === parentNode) continue;
      if (visited.has(neighbor)) {
        // Back edge → cycle from `neighbor` to current tip of path
        const idx = path.indexOf(neighbor);
        if (idx >= 0 && path.length - idx >= 3) {
          result.push(path.slice(idx));
        }
      } else {
        dfs(neighbor, node, path);
      }
    }

    path.pop();
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      dfs(node, null, []);
    }
  }

  return result;
}

/** Shoelace formula for polygon area (result in the same units² as the coords). */
function shoelaceArea(points: Point2D[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i]!.x * points[j]!.y;
    area -= points[j]!.x * points[i]!.y;
  }
  return Math.abs(area) / 2;
}

/**
 * Detects closed rooms from a list of WallSegments.
 *
 * @param segments  Wall segments (v2 model).
 * @param snapThreshold  Max px distance to merge nearby endpoints (default 5).
 * @param pxPerMeter  Scale for areaM2 conversion (default 100 = 1 m per 100 px).
 *
 * Returns one DetectedRoom per closed cycle found in the wall graph.
 * Open contours (U-shapes) produce no rooms.
 */
export function detectRooms(
  segments: WallSegment[],
  snapThreshold = DEFAULT_SNAP_THRESHOLD,
  pxPerMeter = 100,
): DetectedRoom[] {
  const snapped = snapEndpoints(segments, snapThreshold);
  const adj = buildAdj(snapped);
  const cycles = findCycles(adj);

  return cycles.map((cycle, idx) => {
    const vertices = cycle.map((k) => adj.get(k)!.point);
    const cycleKeySet = new Set(cycle);

    const segmentIds = snapped
      .filter(
        (seg) =>
          cycleKeySet.has(nodeKey(seg.p1)) && cycleKeySet.has(nodeKey(seg.p2)),
      )
      .map((seg) => seg.id);

    const areaPx2 = shoelaceArea(vertices);
    const areaM2 = areaPx2 / (pxPerMeter * pxPerMeter);

    return {
      id: `room-${idx}`,
      segmentIds,
      vertices,
      areaM2,
    };
  });
}
