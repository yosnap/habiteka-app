import type { EditorDocument, Point, Furniture, Ramp, Stair } from '@/lib/editor-document/schema';
import { localToWorld, objectCenter, type Footprint } from '@/lib/editor-document/spatial-properties';
import { furnitureVolumes } from '@/lib/editor-document/furniture-volumes';
import { wallMeshes } from './scene/wall-meshes';
import { stairMeshes } from './scene/stair-meshes';
import { wallPath } from '@/lib/editor-document/wall-path';
import { curvedWallMeshes } from './scene/curved-wall-meshes';

interface Solid { id: string; polygon: Point[]; bottom: number; top: number }
const boundsCache = new WeakMap<Solid, { minX: number; maxX: number; minY: number; maxY: number }>();
function bounds(solid: Solid) {
  let value = boundsCache.get(solid);
  if (!value) { value = { minX: Math.min(...solid.polygon.map((p) => p.x)), maxX: Math.max(...solid.polygon.map((p) => p.x)),
    minY: Math.min(...solid.polygon.map((p) => p.y)), maxY: Math.max(...solid.polygon.map((p) => p.y)) }; boundsCache.set(solid, value); }
  return value;
}
export function footprint(item: Footprint): Point[] {
  return [{ x: 0, y: 0 }, { x: item.widthMm, y: 0 }, { x: item.widthMm, y: item.depthMm }, { x: 0, y: item.depthMm }]
    .map((p) => localToWorld(item, p));
}
/** Separating-axis test: contact is allowed, positive penetration is not. */
function penetration(a: Solid, b: Solid): number {
  let depth = Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom);
  if (depth <= .1) return 0;
  const ab = bounds(a), bb = bounds(b);
  if (ab.maxX <= bb.minX + .1 || bb.maxX <= ab.minX + .1 || ab.maxY <= bb.minY + .1 || bb.maxY <= ab.minY + .1) return 0;
  for (const polygon of [a.polygon, b.polygon]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!, q = polygon[(i + 1) % polygon.length]!, length = Math.hypot(q.x - p.x, q.y - p.y);
    if (length < .001) continue;
    const nx = -(q.y - p.y) / length, ny = (q.x - p.x) / length;
    const project = (points: Point[]) => points.map((v) => v.x * nx + v.y * ny);
    const ap = project(a.polygon), bp = project(b.polygon);
    const overlap = Math.min(Math.max(...ap), Math.max(...bp)) - Math.max(Math.min(...ap), Math.min(...bp));
    if (overlap <= .1) return 0;
    depth = Math.min(depth, overlap);
  }
  return depth;
}
function objectSolids(item: Furniture | Stair | Ramp): Solid[] {
  if ('stepCount' in item) return stairMeshes(item).filter((b) => b.role !== 'rail').map((box) => {
    const widthMm = box.size[0] * 1000, depthMm = box.size[2] * 1000, rotation = -box.rotation * 180 / Math.PI;
    const offset = objectCenter({ x: 0, y: 0, widthMm, depthMm, rotation });
    return { id: item.id, polygon: footprint({ x: box.position[0] * 1000 - offset.x, y: box.position[2] * 1000 - offset.y, widthMm, depthMm, rotation }),
      bottom: (box.position[1] - box.size[1] / 2) * 1000, top: (box.position[1] + box.size[1] / 2) * 1000 };
  });
  if ('riseMm' in item) return [{ id: item.id, polygon: footprint(item), bottom: item.elevationMm, top: item.elevationMm + item.riseMm }];
  return furnitureVolumes(item).map((volume) => ({ id: item.id, bottom: volume.bottom, top: volume.top,
    polygon: footprint({ ...item, ...volume, ...localToWorld(item, volume) }) }));
}
function walls(doc: EditorDocument): Solid[] {
  const curved = doc.walls.flatMap((w) => curvedWallMeshes(doc, w)).flatMap((strip) => {
    const n = strip.points.length, half = n / 2;
    return strip.points.slice(0, half - 1).map((_, i) => ({ id: strip.sourceEntityId,
      polygon: [strip.points[i]!, strip.points[i + 1]!, strip.points[n - 2 - i]!, strip.points[n - 1 - i]!].map((p) => ({ x: p.x * 1000, y: p.y * 1000 })),
      bottom: strip.elevation * 1000, top: (strip.elevation + strip.height) * 1000 }));
  });
  return [...curved, ...doc.walls.filter((w) => !w.curveHeightMm).flatMap((w) => wallMeshes(doc, w)).map((box) => {
    const widthMm = box.size[0] * 1000, depthMm = box.size[2] * 1000, rotation = -box.rotation * 180 / Math.PI;
    const offset = objectCenter({ x: 0, y: 0, widthMm, depthMm, rotation });
    return { id: box.sourceEntityId, polygon: footprint({ x: box.position[0] * 1000 - offset.x, y: box.position[2] * 1000 - offset.y, widthMm, depthMm, rotation }),
      bottom: (box.position[1] - box.size[1] / 2) * 1000, top: (box.position[1] + box.size[1] / 2) * 1000 };
  })];
}
function collisions(doc: EditorDocument): Map<string, number> {
  const objects = [...doc.furniture, ...(doc.stairs ?? []), ...(doc.ramps ?? [])].flatMap(objectSolids), wallSolids = walls(doc);
  const result = new Map<string, number>();
  objects.forEach((a, index) => {
    for (const b of [...objects.slice(index + 1), ...wallSolids]) {
      if (a.id === b.id) continue;
      const depth = penetration(a, b);
      if (depth > .1) { const key = JSON.stringify([a.id, b.id].sort()); result.set(key, Math.max(depth, result.get(key) ?? 0)); }
    }
  });
  return result;
}
function snapOriginToWallEndpoint(doc: EditorDocument, item: Furniture | Stair | Ramp, tolerance: number) {
  let closest: Point | null = null, distance = tolerance;
  for (const wall of doc.walls) {
    const path = wallPath(doc, wall);
    for (const point of [path.at(0), path.at(path.length)]) {
      const next = Math.hypot(item.x - point.x, item.y - point.y);
      if (next <= distance) { closest = point; distance = next; }
    }
  }
  return closest ? { ...item, x: closest.x, y: closest.y } : item;
}
/** Legacy intersections remain repairable; edits cannot introduce or deepen one. */
export function assertSpatialPlacement(previous: EditorDocument, candidate: EditorDocument): void {
  const before = collisions(previous), after = collisions(candidate);
  for (const [key, depth] of after) if (depth > (before.get(key) ?? 0) + .1)
    throw new Error('El elemento atraviesa una pared u otro objeto. Ajusta posición, tamaño o elevación.');
}
/** Insert/copy beside the requested location without overlapping existing solids. */
export function placeNewObject(previous: EditorDocument, candidate: EditorDocument, id: string): EditorDocument {
  const item = candidate.furniture.find((f) => f.id === id) ?? candidate.stairs?.find((s) => s.id === id) ?? candidate.ramps?.find((r) => r.id === id);
  if (!item) throw new Error('Elemento no encontrado');
  const occupied = [...walls(previous), ...previous.furniture.flatMap(objectSolids), ...(previous.stairs ?? []).flatMap(objectSolids), ...(previous.ramps ?? []).flatMap(objectSolids)];
  for (let ring = 0; ring <= 32; ring++) for (let direction = 0; direction < (ring ? 8 : 1); direction++) {
    const angle = direction * Math.PI / 4;
    const placed = { ...item, x: item.x + Math.cos(angle) * ring * 250, y: item.y + Math.sin(angle) * ring * 250 };
    if (objectSolids(placed).some((a) => occupied.some((b) => penetration(a, b) > .1))) continue;
    return { ...candidate, furniture: candidate.furniture.map((f) => f.id === id ? placed as Furniture : f),
      stairs: candidate.stairs?.map((s) => s.id === id ? placed as Stair : s),
      ...(candidate.ramps ? { ramps: candidate.ramps.map((r) => r.id === id ? placed as Ramp : r) } : {}) };
  }
  throw new Error('No hay espacio libre cercano. Libera espacio antes de añadir el elemento.');
}
/** Translate to the closest wall face using the complete oriented footprint. */
export function snapObject(doc: EditorDocument, item: Furniture | Stair | Ramp, scale: number, enabled: boolean) {
  // Objects use the same 10 cm grid as drawing points, then can refine to a wall face.
  let result = enabled ? { ...item, x: Math.round(item.x / 100) * 100, y: Math.round(item.y / 100) * 100 } : item;
  if (!enabled) return result;
  const tolerance = 12 / Math.max(.001, scale);
  result = snapOriginToWallEndpoint(doc, result, tolerance);
  for (let pass = 0; pass < 2; pass++) {
    let best: { gap: number; delta: Point } | null = null;
    const corners = footprint(result), center = objectCenter(result);
    for (const wall of doc.walls) {
      const path = wallPath(doc, wall), t = wall.curveHeightMm ? path.project(center) : 0;
      const a = path.at(t), direction = path.tangent(t), length = path.length, ux = direction.x, uy = direction.y;
      const longitudinal = corners.map((p) => (p.x - a.x) * ux + (p.y - a.y) * uy);
      if (Math.max(...longitudinal) < 0 || Math.min(...longitudinal) > length) continue;
      const side = ((center.x - a.x) * -uy + (center.y - a.y) * ux) >= 0 ? 1 : -1;
      const distances = corners.map((p) => ((p.x - a.x) * -uy + (p.y - a.y) * ux) * side);
      const gap = Math.min(...distances) - wall.thicknessMm / 2;
      if (Math.abs(gap) <= tolerance && Math.abs(gap) > .01 && (!best || Math.abs(gap) < Math.abs(best.gap)))
        best = { gap, delta: { x: uy * gap * side, y: -ux * gap * side } };
    }
    if (best) result = { ...result, x: result.x + best.delta.x, y: result.y + best.delta.y };
  }
  return snapOriginToWallEndpoint(doc, result, tolerance);
}
