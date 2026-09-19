import { planObjects } from '@/lib/editor-document/boundary-types';
import { nudgeElements } from './nudge-elements';
import type { EditorDocument, Point, Opening } from '@/lib/editor-document/schema';
import type { CatalogEntry } from '@/canvas/catalog';
import type { FurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { reconcileCeilings } from '@/lib/editor-document/ceiling-reconciliation';
import { luminairePlacementIssue } from '@/lib/editor-document/ceiling-geometry';
import { constrainExteriorVertex } from '@/lib/editor-document/exterior-vertex-constraint';
import { distance, wallPoints } from '@/lib/editor-document/geometry';
import { assertEditorDocument } from '@/lib/editor-document/validation';
import { deriveRooms, deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { floorElevationAt, wallFloorElevation } from '@/lib/editor-document/floor-level';
import { wallConstruction, openingConstruction } from '@/lib/editor-document/construction-properties';
import { finishColor, furnitureSpatial, upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { wallPath } from '@/lib/editor-document/wall-path';
import { syncRampArrival } from '@/lib/editor-document/construction-commands';
import { landingWallPlacement } from '@/lib/editor-document/landing-wall-placement';
import { joinPointToWall, wallSupportAt } from '@/lib/editor-document/wall-join';

export const newId = () => globalThis.crypto.randomUUID();
export function editDocument(doc: EditorDocument, edit: (next: EditorDocument) => void) {
  const next = structuredClone(doc);
  edit(next);
  const reconciled = reconcileCeilings(doc, next);
  assertEditorDocument(reconciled);
  return reconciled;
}
export function snapPoint(doc: EditorDocument, p: Point, enabled: boolean): Point {
  if (!enabled) return p;
  const vertex = doc.vertices.find((v) => distance(v, p) < 150);
  return vertex ? { x: vertex.x, y: vertex.y } : {
    x: Math.round(p.x / 100) * 100, y: Math.round(p.y / 100) * 100,
  };
}
export function addWallPath(doc: EditorDocument, points: Point[], closed = false) {
  const placement = !closed && points.length === 2 ? landingWallPlacement(doc, points as [Point, Point]) : null;
  const path = placement?.points ?? points;
  // Las estancias existentes se leen antes de dibujar: un tabique que divide una estancia elevada nace con su
  // coronación a la misma altura que los muros de esa estancia (altura estándar más la cota del suelo).
  const roomsBefore = deriveRoomsSafe(doc);
  return editDocument(doc, (next) => {
    const ids = path.map((p) => {
      const existing = next.vertices.find((v) => distance(v, p) < 0.01);
      if (existing) return existing.id;
      // Un extremo que cae sobre el cuerpo de un muro existente lo divide y comparte vértice: la estancia queda cerrada.
      const support = wallSupportAt(next, p);
      if (support) return joinPointToWall(next, support);
      const id = newId(); next.vertices.push({ id, ...p }); return id;
    });
    for (let i = 0; i < ids.length - (closed ? 0 : 1); i++) {
      const wall = { id: newId(), startVertexId: ids[i]!,
        endVertexId: ids[(i + 1) % ids.length]!, thicknessMm: 150, dimensionalOrigin: 'physical' as const };
      const a = path[i]!, b = path[(i + 1) % path.length]!;
      const floor = placement ? 0 : floorElevationAt(doc, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, roomsBefore);
      const heightMm = (next.levels ? next.levels.find((l) => l.id === next.activeLevelId)!.heightMm : wallConstruction(wall).heightMm) + floor;
      next.walls.push(next.schemaVersion >= 3 ? { ...wall, ...wallConstruction(wall), heightMm,
        ...(placement ? { baseElevationMm: placement.elevationMm } : {}),
        ...(next.schemaVersion >= 4 ? { colors: { left: finishColor('plaster-white'), right: finishColor('plaster-white') } } : {}) } : wall);
    }
  });
}
/** Murete independiente: un tramo abierto que protege un borde de rampa o descansillo. */
export function addGuardWallPath(doc: EditorDocument, points: Point[]) {
  const source = upgradeConstructionDocument(doc);
  const placement = points.length === 2 ? landingWallPlacement(source, points as [Point, Point]) : null;
  const path = placement?.points ?? points;
  return editDocument(source, (next) => {
    const ids = path.map((point) => {
      const existing = next.vertices.find((vertex) => distance(vertex, point) < .01);
      if (existing) return existing.id;
      const support = wallSupportAt(next, point);
      if (support) return joinPointToWall(next, support);
      const id = newId(); next.vertices.push({ id, ...point }); return id;
    });
    const elevationMm = placement?.elevationMm ?? 0;
    for (let index = 0; index < ids.length - 1; index++) {
      const wall = { id: newId(), startVertexId: ids[index]!, endVertexId: ids[index + 1]!, thicknessMm: 150,
        dimensionalOrigin: 'physical' as const };
      next.walls.push({ ...wall, ...wallConstruction(wall), heightMm: 1100, baseElevationMm: elevationMm,
        ...(next.schemaVersion >= 4 ? { colors: { left: finishColor('plaster-white'), right: finishColor('plaster-white') } } : {}) });
    }
  });
}

/** Repairs legacy protection walls drawn before landing-edge support existed. */
export function repairLandingProtectionWalls(doc: EditorDocument): EditorDocument {
  // This is deliberately tolerant of the old invalid geometry it repairs.
  // `upgradeConstructionDocument` parses first and would reject intersecting legacy muretes.
  const source = structuredClone(doc);
  const candidates = source.walls.flatMap((wall) => {
    if (wallConstruction(wall).heightMm > 1500) return [];
    const [from, to] = wallPoints(source, wall), placement = landingWallPlacement(source, [from, to]);
    return placement && distance(...placement.points) > .01 ? [{ wall, placement }] : [];
  });
  const candidateIds = new Set(candidates.map(({ wall }) => wall.id));
  const movable = candidates.filter(({ wall }) => [wall.startVertexId, wall.endVertexId].every((vertexId) =>
    source.walls.filter((item) => item.startVertexId === vertexId || item.endVertexId === vertexId).every((item) => candidateIds.has(item.id))));
  if (!movable.length) return source;
  return editDocument(source, (next) => {
    const expected = new Map<string, Point>();
    const changed = new Set<string>();
    for (const { wall, placement } of movable) {
      const pairs: [string, Point][] = [[wall.startVertexId, placement.points[0]], [wall.endVertexId, placement.points[1]]];
      if (pairs.some(([id, point]) => expected.has(id) && distance(expected.get(id)!, point) > .01)) continue;
      pairs.forEach(([id, point]) => expected.set(id, point)); changed.add(wall.id);
    }
    next.vertices.forEach((vertex) => { const point = expected.get(vertex.id); if (point) Object.assign(vertex, point); });
    next.walls.filter((wall) => changed.has(wall.id)).forEach((wall) => {
      const placement = movable.find((item) => item.wall.id === wall.id)!.placement;
      wall.baseElevationMm = placement.elevationMm;
    });
    const canonical = new Map<string, string>();
    for (const wall of next.walls.filter((item) => changed.has(item.id))) for (const vertexId of [wall.startVertexId, wall.endVertexId]) {
      const vertex = next.vertices.find((item) => item.id === vertexId)!;
      const match = [...canonical.entries()].find(([, id]) => distance(vertex, next.vertices.find((item) => item.id === id)!) < .01);
      if (match) canonical.set(vertexId, match[1]); else canonical.set(vertexId, vertexId);
    }
    next.walls.filter((wall) => changed.has(wall.id)).forEach((wall) => {
      wall.startVertexId = canonical.get(wall.startVertexId)!; wall.endVertexId = canonical.get(wall.endVertexId)!;
    });
    next.vertices = next.vertices.filter((vertex) => next.walls.some((wall) => wall.startVertexId === vertex.id || wall.endVertexId === vertex.id));
  });
}
export function addOpening(doc: EditorDocument, wallId: string, p: Point, kind: Opening['kind']) {
  return editDocument(doc, (next) => {
    const wall = next.walls.find((w) => w.id === wallId);
    if (!wall) throw new Error('Selecciona un muro para colocar la abertura.');
    const path = wallPath(next, wall), length = path.length;
    const widthMm = kind === 'ventana' ? 1200 : 900;
    if (length < widthMm) throw new Error('El muro es demasiado corto para esta abertura.');
    const t = path.project(p);
    const opening = { id: newId(), wallId, kind, widthMm,
      position: Math.max(widthMm / 2 / length, Math.min(1 - widthMm / 2 / length, t)),
      dimensionalOrigin: 'physical' as const };
    // La puerta arranca en el suelo de la estancia y la ventana a su altura estándar sobre ese suelo.
    const floor = wallFloorElevation(next, wall);
    next.openings.push(next.schemaVersion >= 3 ? { ...opening, ...openingConstruction(opening), elevationMm: openingConstruction(opening).elevationMm + floor,
      ...(next.schemaVersion >= 4 ? { colors: { frame: '#f4f1e9', leaf: '#bb956c' } } : {}) } : opening);
  });
}
export function addFurniture(doc: EditorDocument, item: CatalogEntry | FurnitureCatalogEntry, p: Point) {
  const catalogItem = 'profile' in item ? item : undefined;
  const widthMm = 'widthMm' in item ? item.widthMm : item.realWidthM * 1000;
  const depthMm = 'depthMm' in item ? item.depthMm : item.realDepthM * 1000;
  let position = p;
  // A viewport center may fall in the missing corner of an L. Prefer a room interior.
  try {
    const rooms = deriveRooms(doc);
    const room = catalogItem?.room === 'exterior' ? rooms.find((candidate) =>
      candidate.wallIds.some((id) => id.startsWith('outdoor:')) ||
      doc.labels.some((label) => /patio|terraza|jard[ií]n|exterior/i.test(label.text) && insidePolygon(label, candidate.boundary))) : rooms[0];
    if (room) {
      const polygon = room.boundary;
      const center = interiorPoint(polygon);
      const candidate = { x: center.x - widthMm / 2, y: center.y - depthMm / 2 };
      if ([[0, 0], [widthMm, 0], [widthMm, depthMm], [0, depthMm]].every(([x, y]) =>
        insidePolygon({ x: candidate.x + x!, y: candidate.y + y! }, polygon))) position = candidate;
    }
  } catch { /* Ambiguous rooms do not block manually placing furniture in the viewport. */ }
  return editDocument(catalogItem ? upgradeSpatialDocument(doc) : doc, (next) => { const furniture = { id: newId(), kind: item.kind,
    catalogId: catalogItem?.id ?? `builtin:${item.kind}`, ...position, widthMm,
    depthMm, rotation: 0, dimensionalOrigin: 'physical' as const };
    next.furniture.push(catalogItem ? { ...furniture, heightMm: catalogItem.heightMm,
      elevationMm: catalogItem.elevationMm, color: catalogItem.color }
      : next.schemaVersion >= 4 ? { ...furniture, ...furnitureSpatial(furniture) } : furniture);
  });
}

function insidePolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
/** Interior clearance, unlike an average of vertices, works for concave rooms. */
export function interiorPoint(polygon: Point[]): Point {
  const minX = Math.min(...polygon.map((p) => p.x)), maxX = Math.max(...polygon.map((p) => p.x));
  const minY = Math.min(...polygon.map((p) => p.y)), maxY = Math.max(...polygon.map((p) => p.y));
  let best = polygon[0]!, clearance = -1;
  for (let row = 1; row < 16; row++) for (let col = 1; col < 16; col++) {
    const p = { x: minX + (maxX - minX) * col / 16, y: minY + (maxY - minY) * row / 16 };
    if (!insidePolygon(p, polygon)) continue;
    const gap = Math.min(...polygon.map((a, i) => {
      const b = polygon[(i + 1) % polygon.length]!, length = distance(a, b);
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length ** 2));
      return distance(p, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }));
    if (gap > clearance) { best = p; clearance = gap; }
  }
  return best;
}
export function deleteEntities(doc: EditorDocument, ids: string[]) {
  return editDocument(doc, (next) => {
    next.walls = next.walls.filter((w) => !ids.includes(w.id));
    next.openings = next.openings.filter((o) => !ids.includes(o.id) && !ids.includes(o.sourceRampId ?? '') && next.walls.some((w) => w.id === o.wallId));
    next.furniture = next.furniture.filter((o) => !ids.includes(o.id));
    if (next.boundaries) {
      next.boundaries = next.boundaries.filter((o) => !ids.includes(o.id));
      for (const b of next.boundaries) b.construction.gates = b.construction.gates.filter((g) => !ids.includes(g.id));
    }
    next.labels = next.labels.filter((o) => !ids.includes(o.id));
    next.dimensions = next.dimensions.filter((o) => !ids.includes(o.id));
    if (next.stairs) next.stairs = next.stairs.filter((o) => !ids.includes(o.id));
    if (next.ramps) next.ramps = next.ramps.filter((o) => !ids.includes(o.id));
    if (next.luminaires) next.luminaires = next.luminaires.filter((light) => !ids.includes(light.id));
    if (next.columns) next.columns = next.columns.filter((o) => !ids.includes(o.id));
    if (next.comments) {
      const retained = new Set([...next.walls, ...next.openings, ...planObjects(next), ...(next.stairs ?? []), ...(next.ramps ?? []), ...(next.columns ?? [])].map((e) => e.id));
      next.comments = next.comments.filter((c) => retained.has(c.targetEntityId));
    }
    next.vertices = next.vertices.filter((v) => next.walls.some((w) => w.startVertexId === v.id || w.endVertexId === v.id));
  });
}
export function moveEntity(doc: EditorDocument, id: string, delta: Point) {
  const spatial = [...planObjects(doc), ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])].some((f) => f.id === id);
  const moved = editDocument(spatial ? upgradeSpatialDocument(doc) : doc, (next) => {
    const wall = next.walls.find((w) => w.id === id);
    if (wall) next.vertices.filter((v) => v.id === wall.startVertexId || v.id === wall.endVertexId)
      .forEach((v) => Object.assign(v, constrainExteriorVertex(doc, v.id, { x: v.x + delta.x, y: v.y + delta.y })));
    const item = next.luminaires?.find((light) => light.id === id) ?? planObjects(next).find((f) => f.id === id) ?? next.labels.find((f) => f.id === id)
      ?? next.stairs?.find((f) => f.id === id) ?? next.ramps?.find((f) => f.id === id) ?? next.columns?.find((f) => f.id === id);
    if (item) { item.x += delta.x; item.y += delta.y; }
    const light = next.luminaires?.find((entry) => entry.id === id);
    if (light) { const issue = luminairePlacementIssue(next, light); if (issue) throw new Error(issue); }
  });
  return moved.ramps?.some((ramp) => ramp.id === id) ? syncRampArrival(moved, id) : moved;
}
/** One history action for precise keyboard movement of movable construction and furniture. */
export function nudgeSpatialEntities(doc: EditorDocument, ids: string[], delta: Point): EditorDocument {
  return nudgeElements(doc, ids, delta);
}
export function shapePoints(kind: 'L' | 'U' | 'T', p: Point): Point[] {
  const paths = {
    L: [[0, 0], [6000, 0], [6000, 3000], [3000, 3000], [3000, 6000], [0, 6000]],
    U: [[0, 0], [6000, 0], [6000, 6000], [4000, 6000], [4000, 2000], [2000, 2000], [2000, 6000], [0, 6000]],
    T: [[0, 0], [6000, 0], [6000, 2000], [4000, 2000], [4000, 6000], [2000, 6000], [2000, 2000], [0, 2000]],
  };
  return paths[kind].map(([x, y]) => ({ x: p.x + x!, y: p.y + y! }));
}
