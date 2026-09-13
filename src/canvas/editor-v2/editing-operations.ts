import type { EditorDocument, Point, Opening } from '@/lib/editor-document/schema';
import type { CatalogEntry } from '@/canvas/catalog';
import type { FurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { distance } from '@/lib/editor-document/geometry';
import { assertEditorDocument } from '@/lib/editor-document/validation';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { wallConstruction, openingConstruction } from '@/lib/editor-document/construction-properties';
import { finishColor, furnitureSpatial, localToWorld, upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { isRampLanding } from '@/lib/editor-document/ramp-kind';
import { wallPath } from '@/lib/editor-document/wall-path';
import { syncRampArrival } from '@/lib/editor-document/construction-commands';

export const newId = () => globalThis.crypto.randomUUID();
export function editDocument(doc: EditorDocument, edit: (next: EditorDocument) => void) {
  const next = structuredClone(doc);
  edit(next);
  assertEditorDocument(next);
  return next;
}
export function snapPoint(doc: EditorDocument, p: Point, enabled: boolean): Point {
  if (!enabled) return p;
  const vertex = doc.vertices.find((v) => distance(v, p) < 150);
  return vertex ? { x: vertex.x, y: vertex.y } : {
    x: Math.round(p.x / 100) * 100, y: Math.round(p.y / 100) * 100,
  };
}
export function addWallPath(doc: EditorDocument, points: Point[], closed = false) {
  return editDocument(doc, (next) => {
    const ids = points.map((p) => {
      const existing = next.vertices.find((v) => distance(v, p) < 0.01);
      if (existing) return existing.id;
      const id = newId(); next.vertices.push({ id, ...p }); return id;
    });
    for (let i = 0; i < ids.length - (closed ? 0 : 1); i++) {
      const wall = { id: newId(), startVertexId: ids[i]!,
        endVertexId: ids[(i + 1) % ids.length]!, thicknessMm: 150, dimensionalOrigin: 'physical' as const };
      next.walls.push(next.schemaVersion >= 3 ? { ...wall, ...wallConstruction(wall),
        ...(next.levels ? { heightMm: next.levels.find((l) => l.id === next.activeLevelId)!.heightMm } : {}),
        ...(next.schemaVersion >= 4 ? { colors: { left: finishColor('plaster-white'), right: finishColor('plaster-white') } } : {}) } : wall);
    }
  });
}
/** Murete independiente: un tramo abierto que protege un borde de rampa o descansillo. */
export function addGuardWallPath(doc: EditorDocument, points: Point[]) {
  const source = upgradeConstructionDocument(doc);
  return editDocument(source, (next) => {
    const ids = points.map((point) => {
      const existing = next.vertices.find((vertex) => distance(vertex, point) < .01);
      if (existing) return existing.id;
      const id = newId(); next.vertices.push({ id, ...point }); return id;
    });
    const elevationMm = landingElevation(next, points);
    for (let index = 0; index < ids.length - 1; index++) {
      const wall = { id: newId(), startVertexId: ids[index]!, endVertexId: ids[index + 1]!, thicknessMm: 150,
        dimensionalOrigin: 'physical' as const };
      next.walls.push({ ...wall, ...wallConstruction(wall), heightMm: 1100, baseElevationMm: elevationMm,
        ...(next.schemaVersion >= 4 ? { colors: { left: finishColor('plaster-white'), right: finishColor('plaster-white') } } : {}) });
    }
  });
}

function landingElevation(doc: EditorDocument, points: Point[]): number {
  const midpoint = { x: (points[0]!.x + points.at(-1)!.x) / 2, y: (points[0]!.y + points.at(-1)!.y) / 2 };
  const nearby = (doc.ramps ?? []).filter(isRampLanding).map((landing) => {
    const corners = [{ x: 0, y: 0 }, { x: landing.widthMm, y: 0 }, { x: landing.widthMm, y: landing.depthMm }, { x: 0, y: landing.depthMm }]
      .map((point) => localToWorld(landing, point));
    const gap = Math.min(...corners.map((from, index) => {
      const to = corners[(index + 1) % corners.length]!;
      const length = distance(from, to), t = Math.max(0, Math.min(1, ((midpoint.x - from.x) * (to.x - from.x) + (midpoint.y - from.y) * (to.y - from.y)) / length ** 2));
      return distance(midpoint, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    }));
    return { elevationMm: landing.elevationMm, gap };
  }).filter((candidate) => candidate.gap <= 200).sort((a, b) => a.gap - b.gap)[0];
  return nearby?.elevationMm ?? 0;
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
    next.openings.push(next.schemaVersion >= 3 ? { ...opening, ...openingConstruction(opening),
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
    const room = deriveRooms(doc)[0];
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
    next.labels = next.labels.filter((o) => !ids.includes(o.id));
    next.dimensions = next.dimensions.filter((o) => !ids.includes(o.id));
    if (next.stairs) next.stairs = next.stairs.filter((o) => !ids.includes(o.id));
    if (next.ramps) next.ramps = next.ramps.filter((o) => !ids.includes(o.id));
    if (next.columns) next.columns = next.columns.filter((o) => !ids.includes(o.id));
    if (next.comments) {
      const retained = new Set([...next.walls, ...next.openings, ...next.furniture, ...(next.stairs ?? []), ...(next.ramps ?? []), ...(next.columns ?? [])].map((e) => e.id));
      next.comments = next.comments.filter((c) => retained.has(c.targetEntityId));
    }
    next.vertices = next.vertices.filter((v) => next.walls.some((w) => w.startVertexId === v.id || w.endVertexId === v.id));
  });
}
export function moveEntity(doc: EditorDocument, id: string, delta: Point) {
  const spatial = [...doc.furniture, ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])].some((f) => f.id === id);
  const moved = editDocument(spatial ? upgradeSpatialDocument(doc) : doc, (next) => {
    const wall = next.walls.find((w) => w.id === id);
    if (wall) next.vertices.filter((v) => v.id === wall.startVertexId || v.id === wall.endVertexId)
      .forEach((v) => { v.x += delta.x; v.y += delta.y; });
    const item = next.furniture.find((f) => f.id === id) ?? next.labels.find((f) => f.id === id)
      ?? next.stairs?.find((f) => f.id === id) ?? next.ramps?.find((f) => f.id === id) ?? next.columns?.find((f) => f.id === id);
    if (item) { item.x += delta.x; item.y += delta.y; }
  });
  return moved.ramps?.some((ramp) => ramp.id === id) ? syncRampArrival(moved, id) : moved;
}
/** One history action for precise keyboard movement of movable construction and furniture. */
export function nudgeSpatialEntities(doc: EditorDocument, ids: string[], delta: Point): EditorDocument {
  const moved = editDocument(upgradeSpatialDocument(doc), (next) => {
    const selected = new Set(ids);
    [...next.furniture, ...(next.stairs ?? []), ...(next.ramps ?? []), ...(next.columns ?? [])].forEach((item) => {
      if (selected.has(item.id)) { item.x += delta.x; item.y += delta.y; }
    });
  });
  return (moved.ramps ?? []).filter((ramp) => ids.includes(ramp.id))
    .reduce((next, ramp) => syncRampArrival(next, ramp.id), moved);
}
export function shapePoints(kind: 'L' | 'U' | 'T', p: Point): Point[] {
  const paths = {
    L: [[0, 0], [6000, 0], [6000, 3000], [3000, 3000], [3000, 6000], [0, 6000]],
    U: [[0, 0], [6000, 0], [6000, 6000], [4000, 6000], [4000, 2000], [2000, 2000], [2000, 6000], [0, 6000]],
    T: [[0, 0], [6000, 0], [6000, 2000], [4000, 2000], [4000, 6000], [2000, 6000], [2000, 2000], [0, 2000]],
  };
  return paths[kind].map(([x, y]) => ({ x: p.x + x!, y: p.y + y! }));
}
