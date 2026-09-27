import { planObjects } from '@/lib/editor-document/boundary-types';
import type { Estilo } from '@/lib/contracts';
import { newId } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from './rooms';
import { floorFinish } from './floor-finishes';
import { surfaceMaterial } from './surface-materials';
import { finishColor, localToWorld, upgradeSpatialDocument } from './spatial-properties';
import { parseEditorDocument } from './validation';
import type { EditorDocument, FloorFinish, Point } from './schema';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { assertCompatibleDesignStyle, designScopeRooms, scopeContainsPoint, scopedWallSides, wholeDesignScope, type DesignScope } from './design-scope';
import { eligibleCeilingRooms } from './ceiling-geometry';
import { wallConstruction } from './construction-properties';

export interface NativeDesignFurniture {
  catalogId: string;
  xMm: number;
  yMm: number;
  rotation: number;
  reason: string;
}

export interface NativeDesignProposal {
  style: Estilo;
  summary: string;
  scope?: DesignScope;
  sourceRevision?: number;
  materials: {
    walls: string;
    floors: FloorFinish['texture'];
    stairs: string;
    ramps: string;
    columns: string;
  };
  furniture: NativeDesignFurniture[];
}

export interface NativeDesignSelection {
  walls: boolean;
  floors: boolean;
  stairs: boolean;
  ramps: boolean;
  columns: boolean;
  furniture: number[];
}

/** Applies only decorative data. Geometry, levels, dimensions and circulation stay intact. */
export function applyNativeDesignProposal(source: EditorDocument, proposal: NativeDesignProposal, selection: NativeDesignSelection = everything(proposal)): EditorDocument {
  if (proposal.sourceRevision !== undefined && proposal.sourceRevision !== source.revision)
    throw new Error('El plano cambió desde que se generó la propuesta. Vuelve a generar el diseño sobre la versión actual.');
  const scope = proposal.scope ?? wholeDesignScope();
  assertCompatibleDesignStyle(source, proposal.style, scope);
  const doc = upgradeSpatialDocument(source);
  const rooms = deriveRooms(doc), selectedRooms = designScopeRooms(doc, scope);
  const allowedRooms = new Set(selectedRooms.map((room) => room.id));
  const indoorRooms = scope.kind === 'exterior' ? eligibleCeilingRooms(doc) : [];
  // Las propuestas añaden acabados de suelo: el formato v4 no admite ese campo.
  if (doc.schemaVersion < 5) doc.schemaVersion = 5;
  doc.floorFinishes ??= [];
  const material = (id: string) => surfaceMaterial(id) ? id : 'plaster-white';
  const walls = material(proposal.materials.walls);
  const stairs = material(proposal.materials.stairs);
  const ramps = material(proposal.materials.ramps);
  const columns = material(proposal.materials.columns);
  const floorTexture = isFloorTexture(proposal.materials.floors) ? proposal.materials.floors : 'none';

  if (selection.walls) doc.walls.forEach((wall) => {
    const sides = scope.kind === 'all' ? ['left', 'right'] as const
      : scope.kind !== 'exterior' ? scopedWallSides(wall, selectedRooms)
        : exteriorWallSides(wall, selectedRooms, indoorRooms);
    if (!sides.length) return;
    const previous = wallConstruction(wall).materials;
    wall.materials ??= previous;
    wall.colors ??= {
      left: surfaceMaterial(previous.left) ? '#ffffff' : finishColor(previous.left),
      right: surfaceMaterial(previous.right) ? '#ffffff' : finishColor(previous.right),
    };
    for (const side of sides) {
      wall.materials[side] = walls;
      wall.colors[side] = '#ffffff';
    }
  });
  const inScope = (item: { x: number; y: number; widthMm: number; depthMm: number; rotation: number }) => {
    if (scope.kind === 'all') return true;
    const point = localToWorld(item, { x: item.widthMm / 2, y: item.depthMm / 2 });
    return scopeContainsPoint(selectedRooms, point) ||
      (scope.kind === 'exterior' && !scopeContainsPoint(indoorRooms, point));
  };
  if (selection.stairs) doc.stairs?.filter(inScope).forEach((stair) => { stair.materialId = stairs; stair.color = '#ffffff'; });
  if (selection.ramps) doc.ramps?.filter(inScope).forEach((ramp) => { ramp.materialId = ramps; ramp.color = '#ffffff'; });
  if (selection.columns) doc.columns?.filter(inScope).forEach((column) => { column.materialId = columns; column.color = '#ffffff'; });

  if (selection.floors) for (const room of selectedRooms) {
    const current = floorFinish(doc, room.id);
    doc.floorFinishes = doc.floorFinishes.filter((finish) => finish.roomId !== room.id);
    doc.floorFinishes.push({ ...current, roomId: room.id, texture: floorTexture, color: '#ffffff' });
  }
  for (const index of selection.furniture) {
    const item = proposal.furniture[index];
    if (item) addSuggestedFurniture(doc, item, rooms, allowedRooms);
  }
  doc.designStyle = proposal.style;
  doc.revision += 1;
  return parseEditorDocument(doc);
}

function everything(proposal: NativeDesignProposal): NativeDesignSelection {
  return { walls: true, floors: true, stairs: true, ramps: true, columns: true,
    furniture: proposal.furniture.map((_, index) => index) };
}

function exteriorWallSides(wall: EditorDocument['walls'][number], selected: ReturnType<typeof deriveRooms>, indoors: ReturnType<typeof deriveRooms>): ('left' | 'right')[] {
  const sides = new Set(scopedWallSides(wall, selected));
  const indoorSides = scopedWallSides(wall, indoors);
  if (indoorSides.length === 1) sides.add(indoorSides[0] === 'left' ? 'right' : 'left');
  if (!indoorSides.length && !wall.hidden) return ['left', 'right'];
  return [...sides];
}

function addSuggestedFurniture(doc: EditorDocument, item: NativeDesignFurniture, rooms: ReturnType<typeof deriveRooms>, allowedRooms: ReadonlySet<string>) {
  const catalog = getFurnitureCatalogEntry(item.catalogId);
  if (!catalog || !Number.isFinite(item.xMm) || !Number.isFinite(item.yMm) || !Number.isFinite(item.rotation)) return;
  const room = suggestedFurnitureRoom(item, rooms);
  if (!room || !canPlaceNativeDesignFurniture(doc, item, rooms, allowedRooms)) return;
  const elevationMm = floorFinish(doc, room.id).elevationMm ?? 0;
  doc.furniture.push({
    id: newId(), kind: catalog.kind, catalogId: catalog.id, x: item.xMm, y: item.yMm,
    widthMm: catalog.widthMm, depthMm: catalog.depthMm, heightMm: catalog.heightMm,
    elevationMm, rotation: item.rotation, dimensionalOrigin: 'physical', color: catalog.color,
  });
}

/** Rejects AI furniture that would block construction or cannot physically fit a room. */
export function canPlaceNativeDesignFurniture(
  doc: EditorDocument,
  item: NativeDesignFurniture,
  rooms = deriveRooms(doc),
  allowedRooms?: ReadonlySet<string>,
): boolean {
  const catalog = getFurnitureCatalogEntry(item.catalogId);
  if (!catalog || !Number.isFinite(item.xMm) || !Number.isFinite(item.yMm) || !Number.isFinite(item.rotation)) return false;
  const candidate = { x: item.xMm, y: item.yMm, widthMm: catalog.widthMm, depthMm: catalog.depthMm, rotation: item.rotation };
  const room = suggestedFurnitureRoom(item, rooms);
  if (!room || (allowedRooms && !allowedRooms.has(room.id))) return false;
  const protectedFootprints = [...planObjects(doc), ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])];
  return !protectedFootprints.some((target) => intersects(candidate, target, 250));
}

function suggestedFurnitureRoom(item: NativeDesignFurniture, rooms: ReturnType<typeof deriveRooms>) {
  const catalog = getFurnitureCatalogEntry(item.catalogId);
  if (!catalog) return undefined;
  const candidate = { x: item.xMm, y: item.yMm, widthMm: catalog.widthMm, depthMm: catalog.depthMm, rotation: item.rotation };
  return rooms.find((room) => corners(candidate).every((point) => contains(room.boundary, point)));
}

function corners(item: { x: number; y: number; widthMm: number; depthMm: number; rotation: number }) {
  return [[0, 0], [item.widthMm, 0], [item.widthMm, item.depthMm], [0, item.depthMm]].map(([x, y]) =>
    localToWorld(item, { x: x!, y: y! }));
}

function intersects(
  source: { x: number; y: number; widthMm: number; depthMm: number; rotation: number },
  target: { x: number; y: number; widthMm: number; depthMm: number; rotation: number },
  clearanceMm: number,
) {
  const a = bounds(corners(source)), b = bounds(corners(target));
  return a.minX < b.maxX + clearanceMm && a.maxX > b.minX - clearanceMm
    && a.minY < b.maxY + clearanceMm && a.maxY > b.minY - clearanceMm;
}

function bounds(points: Point[]) {
  return { minX: Math.min(...points.map((point) => point.x)), maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)), maxY: Math.max(...points.map((point) => point.y)) };
}

function contains(boundary: Point[], point: Point) {
  let inside = false;
  for (let index = 0, previous = boundary.length - 1; index < boundary.length; previous = index++) {
    const from = boundary[index]!, to = boundary[previous]!;
    if ((from.y > point.y) !== (to.y > point.y) && point.x < ((to.x - from.x) * (point.y - from.y)) / (to.y - from.y) + from.x) inside = !inside;
  }
  return inside;
}

function isFloorTexture(value: string): value is FloorFinish['texture'] {
  return value === 'none' || value === 'wood' || value === 'tile' || Boolean(surfaceMaterial(value));
}
