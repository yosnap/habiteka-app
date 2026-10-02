import { planObjects } from '@/lib/editor-document/boundary-types';
import type { Estilo } from '@/lib/contracts';
import { newId } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from './rooms';
import { floorFinish } from './floor-finishes';
import { surfaceMaterial } from './surface-materials';
import { finishColor, localToWorld, upgradeSpatialDocument } from './spatial-properties';
import { parseEditorDocument } from './validation';
import type { EditorDocument, FloorFinish, Furniture, Point } from './schema';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { outdoorVolumes } from './outdoor-volumes';
import { assertCompatibleDesignStyle, designScopeRooms, designScopeStructureIds, designScopeZone, scopeContainsPoint, scopedWallSides, wholeDesignScope, type DesignScope } from './design-scope';
import { polygonContainsFootprint } from './proposal-permissions';
import { wallPath } from './wall-path';
import { eligibleCeilingRooms } from './ceiling-geometry';
import { wallConstruction } from './construction-properties';
import { isRampLanding } from './ramp-kind';
import { canFitOnHost, canRestOnHost, hostSurfaceTop, isSurfaceHost, restOnHost } from './object-host-rest';
import { sameDesignContent } from './approved-design';
import { assertSpatialPlacement } from '@/canvas/editor-v2/spatial-placement';
import { applyFixedFinishes, type FixedDesignFinish } from './fixed-design-finishes';

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
    slabUndersides?: FloorFinish['undersideTexture'];
    stairBodies?: FloorFinish['undersideTexture'];
    rampBodies?: FloorFinish['undersideTexture'];
    landingBodies?: FloorFinish['undersideTexture'];
    stairs: string;
    ramps: string;
    columns: string;
  };
  furniture: NativeDesignFurniture[];
  fixedFinishes?: FixedDesignFinish[];
}

export interface NativeDesignSelection {
  walls: boolean;
  floors: boolean;
  stairs: boolean;
  ramps: boolean;
  columns: boolean;
  furniture: number[];
  fixedFinishes?: number[];
}

/** El servidor devuelve su revisión confirmada; el editor puede conservar otro número local para el mismo contenido. */
export function bindNativeDesignProposal(proposal: NativeDesignProposal, requested: EditorDocument,
  current: EditorDocument): NativeDesignProposal {
  if (!sameDesignContent(requested, current))
    throw new Error('El plano cambió mientras se generaba la propuesta. Vuelve a generarla sobre la versión actual.');
  return { ...proposal, sourceRevision: current.revision };
}

/** Applies only decorative data. Geometry, levels, dimensions and circulation stay intact. */
export function applyNativeDesignProposal(source: EditorDocument, proposal: NativeDesignProposal, selection: NativeDesignSelection = everything(proposal)): EditorDocument {
  if (proposal.sourceRevision !== undefined && proposal.sourceRevision !== source.revision)
    throw new Error('El plano cambió desde que se generó la propuesta. Vuelve a generar el diseño sobre la versión actual.');
  const scope = proposal.scope ?? wholeDesignScope();
  assertCompatibleDesignStyle(source, proposal.style, scope);
  const doc = upgradeSpatialDocument(source);
  const rooms = deriveRooms(doc), selectedRooms = designScopeRooms(doc, scope);
  const zone = scope.kind === 'zone' ? designScopeZone(doc, scope) : null;
  const selectedStructures = designScopeStructureIds(doc, scope);
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
  const slabUnderside = proposal.materials.slabUndersides;
  const stairBody = proposal.materials.stairBodies;
  const rampBody = proposal.materials.rampBodies;
  const landingBody = proposal.materials.landingBodies;

  if (selection.walls) doc.walls.forEach((wall) => {
    const sides = zone ? polygonContainsFootprint(zone.polygon, wallPath(doc, wall).samples()) ? scopedWallSides(wall, selectedRooms) : []
      : scope.kind === 'all' || (scope.kind === 'house' && selectedRooms.some((room) => room.wallIds.includes(wall.id))) ? ['left', 'right'] as const
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
  const inScope = (item: { id: string; x: number; y: number; widthMm: number; depthMm: number; rotation: number }) => {
    if (scope.kind === 'all') return true;
    if (selectedStructures.has(item.id)) return true;
    if (zone) return polygonContainsFootprint(zone.polygon, corners(item));
    const point = localToWorld(item, { x: item.widthMm / 2, y: item.depthMm / 2 });
    return scopeContainsPoint(selectedRooms, point) ||
      (scope.kind === 'exterior' && !scopeContainsPoint(indoorRooms, point));
  };
  if (selection.stairs) doc.stairs?.filter(inScope).forEach((stair) => {
    stair.materialId = stairs;
    stair.color = '#ffffff';
    if (stairBody && surfaceMaterial(stairBody)) stair.bodyMaterialId = stairBody;
  });
  if (selection.ramps) doc.ramps?.filter(inScope).forEach((ramp) => {
    ramp.materialId = ramps;
    ramp.color = '#ffffff';
    const body = isRampLanding(ramp) ? landingBody : rampBody;
    if (body && surfaceMaterial(body)) ramp.bodyMaterialId = body;
  });
  if (selection.columns) doc.columns?.filter(inScope).forEach((column) => { column.materialId = columns; column.color = '#ffffff'; });

  if (selection.floors && zone) {
    const current = zone.floorFinish ?? floorFinish(doc, selectedRooms[0]?.id ?? zone.id);
    zone.floorFinish = { texture: floorTexture, color: '#ffffff', tileSizeMm: current.tileSizeMm, rotation: current.rotation };
  } else if (selection.floors) for (const room of selectedRooms) {
    const current = floorFinish(doc, room.id);
    doc.floorFinishes = doc.floorFinishes.filter((finish) => finish.roomId !== room.id);
    doc.floorFinishes.push({ ...current, roomId: room.id, texture: floorTexture, color: '#ffffff',
      ...((current.elevationMm ?? 0) > 0 && slabUnderside && surfaceMaterial(slabUnderside)
        ? { undersideTexture: slabUnderside, undersideColor: '#ffffff' } : {}) });
  }
  for (const index of selection.furniture) {
    const item = proposal.furniture[index];
    if (item) addSuggestedFurniture(doc, item, rooms, allowedRooms, zone?.polygon);
  }
  applyFixedFinishes(doc, scope, (selection.fixedFinishes ?? []).flatMap((index) => proposal.fixedFinishes?.[index] ?? []));
  doc.designStyle = proposal.style;
  doc.revision += 1;
  return parseEditorDocument(doc);
}

function everything(proposal: NativeDesignProposal): NativeDesignSelection {
  return { walls: true, floors: true, stairs: true, ramps: true, columns: true,
    furniture: proposal.furniture.map((_, index) => index), fixedFinishes: proposal.fixedFinishes?.map((_, index) => index) };
}

function exteriorWallSides(wall: EditorDocument['walls'][number], selected: ReturnType<typeof deriveRooms>, indoors: ReturnType<typeof deriveRooms>): ('left' | 'right')[] {
  const sides = new Set(scopedWallSides(wall, selected));
  const indoorSides = scopedWallSides(wall, indoors);
  if (indoorSides.length === 1) sides.add(indoorSides[0] === 'left' ? 'right' : 'left');
  if (!indoorSides.length && !wall.hidden) return ['left', 'right'];
  return [...sides];
}

export function addSuggestedFurniture(doc: EditorDocument, item: NativeDesignFurniture, rooms: ReturnType<typeof deriveRooms>, allowedRooms: ReadonlySet<string>, zonePolygon?: Point[]) {
  const catalog = getFurnitureCatalogEntry(item.catalogId);
  if (!catalog || !Number.isFinite(item.xMm) || !Number.isFinite(item.yMm) || !Number.isFinite(item.rotation)) return;
  const placement = assessFurniturePlacement(doc, item, rooms, allowedRooms, zonePolygon);
  if (placement.issue || !placement.room) return;
  const elevationMm = (floorFinish(doc, placement.room.id).elevationMm ?? 0) + catalog.elevationMm;
  const furniture: Furniture = {
    id: newId(), kind: catalog.kind, catalogId: catalog.id, x: item.xMm, y: item.yMm,
    widthMm: catalog.widthMm, depthMm: catalog.depthMm, heightMm: catalog.heightMm,
    elevationMm, rotation: item.rotation, dimensionalOrigin: 'physical', color: catalog.color,
  };
  doc.furniture.push(placement.host ? restOnHost(doc, { ...furniture, hostId: placement.host.id,
    elevationMm: hostSurfaceTop(placement.host) }) : furniture);
}

/** Rejects AI furniture that would block construction or cannot physically fit a room. */
export function canPlaceNativeDesignFurniture(
  doc: EditorDocument,
  item: NativeDesignFurniture,
  rooms = deriveRooms(doc),
  allowedRooms?: ReadonlySet<string>,
  zonePolygon?: Point[],
): boolean {
  return assessFurniturePlacement(doc, item, rooms, allowedRooms, zonePolygon).issue === null;
}

export type NativeFurniturePlacementIssue = 'catalog' | 'room' | 'zone' | 'support' | 'wall' | 'collision' | 'shelter'
  | 'environment' | 'circulation' | 'edge';

/** Holgura que deja libre el paso a escaleras y rampas, y a ambos lados de una puerta. */
const CIRCULATION_MM = 1000, DOOR_CLEARANCE_MM = 800;
/** Plantas, jardineras y lámparas de suelo van junto a un borde: a más de esta distancia de todo límite estorban en mitad del espacio. */
export const EDGE_REACH_MM = 900;
const EDGE_PROFILES = new Set(['plant', 'outdoor', 'lamp']);
/** Iluminación y decoración de interior (lámpara de pie, planta de salón…) no se proponen al aire libre. */
const INDOOR_ONLY_ROOMS = new Set(['iluminacion', 'decoracion']);

export function distanceToBoundary(boundary: readonly Point[], point: Point): number {
  let best = Infinity;
  for (let index = 0; index < boundary.length; index++) {
    const from = boundary[index]!, to = boundary[(index + 1) % boundary.length]!;
    const dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length)) : 0;
    best = Math.min(best, Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy)));
  }
  return best;
}

/** Huella cuadrada centrada en una puerta, para reservar el paso delante de ella. */
function doorKeepOut(doc: EditorDocument, opening: EditorDocument['openings'][number]) {
  const wall = doc.walls.find((item) => item.id === opening.wallId);
  if (!wall) return null;
  const centre = wallPath(doc, wall).at(opening.position), size = opening.widthMm;
  return { x: centre.x - size / 2, y: centre.y - size / 2, widthMm: size, depthMm: size, rotation: 0 };
}

export function nativeFurniturePlacementIssue(
  doc: EditorDocument, item: NativeDesignFurniture, rooms = deriveRooms(doc),
  allowedRooms?: ReadonlySet<string>, zonePolygon?: Point[],
): NativeFurniturePlacementIssue | null {
  return assessFurniturePlacement(doc, item, rooms, allowedRooms, zonePolygon).issue;
}

function assessFurniturePlacement(
  doc: EditorDocument, item: NativeDesignFurniture, rooms: ReturnType<typeof deriveRooms>,
  allowedRooms?: ReadonlySet<string>, zonePolygon?: Point[],
): { issue: NativeFurniturePlacementIssue | null; room?: ReturnType<typeof deriveRooms>[number]; host?: Furniture } {
  const catalog = getFurnitureCatalogEntry(item.catalogId);
  if (!catalog || !Number.isFinite(item.xMm) || !Number.isFinite(item.yMm) || !Number.isFinite(item.rotation))
    return { issue: 'catalog' };
  const candidate = { x: item.xMm, y: item.yMm, widthMm: catalog.widthMm, depthMm: catalog.depthMm, rotation: item.rotation };
  const room = suggestedFurnitureRoom(item, rooms);
  if (!room || (allowedRooms && !allowedRooms.has(room.id))) return { issue: 'room' };
  if (zonePolygon && !polygonContainsFootprint(zonePolygon, corners(candidate))) return { issue: 'zone' };
  // Un objeto de interior (lámpara de pie, planta de salón…) no se coloca al aire libre.
  const indoor = eligibleCeilingRooms(doc).some((item) => item.id === room.id);
  if (!indoor && INDOOR_ONLY_ROOMS.has(catalog.room) && !/exterior|outdoor|jardin/.test(catalog.id)) return { issue: 'environment' };
  // El paso a escaleras, rampas y puertas queda libre, no solo sin solapes.
  const passages = [...(doc.stairs ?? []), ...(doc.ramps ?? [])].some((target) => intersects(candidate, target, CIRCULATION_MM))
    || doc.openings.some((opening) => {
      if (opening.kind !== 'puerta') return false;
      const zone = doorKeepOut(doc, opening);
      return !!zone && intersects(candidate, zone, DOOR_CLEARANCE_MM);
    });
  if (passages) return { issue: 'circulation' };
  const candidateItem: Furniture = { id: '__design_candidate', kind: catalog.kind, catalogId: catalog.id,
    ...candidate, heightMm: catalog.heightMm, elevationMm: 0, color: catalog.color,
    dimensionalOrigin: 'physical' };
  const host = canRestOnHost(candidateItem) ? planObjects(doc)
    .filter((target) => isSurfaceHost(target) && canFitOnHost(candidateItem, target)
      && polygonContainsFootprint(corners(target), corners(candidate)))
    .sort((a, b) => hostSurfaceTop(b) - hostSurfaceTop(a))[0] : undefined;
  if (catalog.profile === 'lamp' && catalog.elevationMm > 0 && !host) return { issue: 'support' };
  // Plantas y lámparas de suelo, pegadas a un muro o al borde de la zona; en mitad del espacio estorban.
  if (!host && EDGE_PROFILES.has(catalog.profile) && !catalog.id.includes('tira-led')) {
    const boundary = zonePolygon ?? room.boundary;
    if (corners(candidate).every((point) => distanceToBoundary(boundary, point) > EDGE_REACH_MM)) return { issue: 'edge' };
  }
  const bottom = host ? hostSurfaceTop(host) : (floorFinish(doc, room.id).elevationMm ?? 0) + catalog.elevationMm;
  const shelters = doc.furniture.filter((target) => ['carpa', 'pergola', 'pergola-aluminio', 'pergola-metal'].includes(target.kind));
  const shelterIds = new Set(shelters.map((target) => target.id));
  // Una alfombra va bajo el mobiliario: solo otra alfombra le estorba, y ella no estorba a nadie.
  const isRug = (target: { catalogId?: string }) => getFurnitureCatalogEntry(target.catalogId ?? '')?.profile === 'rug';
  const blockedByObject = planObjects(doc).filter((target) => !shelterIds.has(target.id)
    && (catalog.profile === 'rug' ? isRug(target) : !isRug(target))).some((target) => {
    if (host && (target.id === host.id || (target.elevationMm ?? 0) + (target.heightMm ?? 0) <= bottom)) return false;
    return intersects(candidate, target, 250);
  });
  if (blockedByObject || [...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])]
    .some((target) => intersects(candidate, target, 250))) return { issue: 'collision' };
  if (shelters.some((shelter) => outdoorVolumes(shelter).some((part) => {
    if (part.top <= bottom || part.bottom >= bottom + catalog.heightMm) return false;
    const origin = localToWorld(shelter, { x: part.x, y: part.y });
    return intersects(candidate, { x: origin.x, y: origin.y, widthMm: part.widthMm,
      depthMm: part.depthMm, rotation: shelter.rotation }, 100);
  }))) return { issue: 'shelter' };
  const placed: Furniture = { ...candidateItem, elevationMm: bottom,
    ...(host ? { hostId: host.id } : {}) };
  try { assertSpatialPlacement(doc, { ...doc, furniture: [...doc.furniture, placed] }); }
  catch (error) { return { issue: error instanceof Error && /la pared/.test(error.message) ? 'wall' : 'collision' }; }
  return { issue: null, room, host };
}

function suggestedFurnitureRoom(item: NativeDesignFurniture, rooms: ReturnType<typeof deriveRooms>) {
  const catalog = getFurnitureCatalogEntry(item.catalogId);
  if (!catalog) return undefined;
  const candidate = { x: item.xMm, y: item.yMm, widthMm: catalog.widthMm, depthMm: catalog.depthMm, rotation: item.rotation };
  const footprint = corners(candidate);
  return rooms.filter((room) => footprint.every((point) => contains(room.boundary, point)))
    .sort((a, b) => a.areaMm2 - b.areaMm2)[0];
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
