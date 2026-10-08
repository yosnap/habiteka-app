import { planObjects } from '@/lib/editor-document/boundary-types';
import type { Estilo } from '@/lib/contracts';
import { newId } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from './rooms';
import { floorFinish } from './floor-finishes';
import { surfaceMaterial } from './surface-materials';
import { finishColor, localToWorld, objectCenter, upgradeSpatialDocument } from './spatial-properties';
import { parseEditorDocument } from './validation';
import type { EditorDocument, FloorFinish, Furniture, Point } from './schema';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { outdoorVolumes } from './outdoor-volumes';
import { assertCompatibleDesignStyle, designScopeRooms, designScopeStructureIds, designScopeZone, scopeContainsPoint, scopedWallSides, wholeDesignScope, type DesignScope } from './design-scope';
import { polygonContainsFootprint } from './proposal-permissions';
import { wallPath } from './wall-path';
import { eligibleCeilingRooms } from './ceiling-geometry';
import { openingConstruction, wallConstruction } from './construction-properties';
import { leafReachMm, slideParkingMm } from './opening-types';
import { isRampLanding } from './ramp-kind';
import { canFitOnHost, canRestOnHost, hostSurfaceTop, isSurfaceHost, restOnHost } from './object-host-rest';
import { sameDesignContent } from './approved-design';
import { assertSpatialPlacement } from '@/canvas/editor-v2/spatial-placement';
import { applyFixedFinishes, type FixedDesignFinish } from './fixed-design-finishes';
import { planParts } from './l-sofa-shape';
import { isTelevision } from './native-design-seating';
import { hasRoomTelevision } from './proposal-existing-television';
import { isKitchenRun } from './kitchen-run-types';
import { upgradeKitchenDocument } from './kitchen-run-commands';
import { floorElevationAt } from './floor-level';
import { fitKitchenSlots, KITCHEN_DEPTH_MM, MIN_KITCHEN_MM, proposalKitchenRun, type NativeDesignKitchen } from './native-design-kitchen';
import { proposalSize } from './proposal-coordinates';

export interface NativeDesignFurniture {
  catalogId: string;
  xMm: number;
  yMm: number;
  rotation: number;
  reason: string;
  /** Medida propia (ancho × fondo con su giro): solo una alfombra dibujada en el boceto, que se hace a su medida. */
  widthMm?: number;
  depthMm?: number;
}

/** Suelo y paredes de una estancia: el baño no lleva el mismo pavimento ni el mismo acabado que un dormitorio. */
export interface RoomFinish {
  roomId: string;
  name: string;
  floor: FloorFinish['texture'];
  walls: string;
}

export interface NativeDesignProposal {
  style: Estilo;
  summary: string;
  /** Acabados por estancia; las estancias sin entrada usan `materials.walls` y `materials.floors`. */
  roomFinishes?: RoomFinish[];
  scope?: DesignScope;
  sourceRevision?: number;
  materials: {
    walls: string;
    /** Caras de muro que dan al exterior (fachada); sin valor, las mismas que `walls`. */
    exteriorWalls?: string;
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
  /** Tramos del mueble de cocina modular; se colocan antes que los muebles sueltos. */
  kitchens?: NativeDesignKitchen[];
  /** Objetos dibujados en el boceto del cliente que el catálogo aún no tiene, con su estancia. */
  sketchMissing?: string[];
  fixedFinishes?: FixedDesignFinish[];
}

export interface NativeDesignSelection {
  walls: boolean;
  floors: boolean;
  stairs: boolean;
  ramps: boolean;
  columns: boolean;
  furniture: number[];
  kitchens?: number[];
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
  const kitchens = (selection.kitchens ?? []).flatMap((index) => proposal.kitchens?.[index] ?? []);
  const doc = upgradeSpatialDocument(kitchens.length ? upgradeKitchenDocument(source) : source);
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
  const exterior = proposal.materials.exteriorWalls ? material(proposal.materials.exteriorWalls) : walls;
  const finishByRoom = new Map((proposal.roomFinishes ?? []).map((finish) => [finish.roomId, finish]));
  const indoor = new Set(eligibleCeilingRooms(doc).map((room) => room.id));
  const sideRoom = (wall: EditorDocument['walls'][number], side: 'left' | 'right') => rooms.find((room) => {
    const edge = room.wallIds.indexOf(wall.id);
    return edge >= 0 && (room.vertexIds[edge] === wall.startVertexId ? 'left' : 'right') === side;
  });
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
    // Cada cara toma el acabado de la estancia a la que da; la que da al exterior, el de fachada.
    const faces = Object.fromEntries(sides.map((side) => [side, sideRoom(wall, side)]));
    wall.materials ??= previous;
    wall.colors ??= {
      left: surfaceMaterial(previous.left) ? '#ffffff' : finishColor(previous.left),
      right: surfaceMaterial(previous.right) ? '#ffffff' : finishColor(previous.right),
    };
    for (const side of sides) {
      const room = faces[side];
      wall.materials[side] = room && indoor.has(room.id) ? material(finishByRoom.get(room.id)?.walls ?? walls) : exterior;
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
    const roomFloor = finishByRoom.get(room.id)?.floor;
    doc.floorFinishes.push({ ...current, roomId: room.id, texture: roomFloor && isFloorTexture(roomFloor) ? roomFloor : floorTexture, color: '#ffffff',
      ...((current.elevationMm ?? 0) > 0 && slabUnderside && surfaceMaterial(slabUnderside)
        ? { undersideTexture: slabUnderside, undersideColor: '#ffffff' } : {}) });
  }
  addSuggestedKitchens(doc, kitchens, rooms, allowedRooms);
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
    furniture: proposal.furniture.map((_, index) => index), kitchens: proposal.kitchens?.map((_, index) => index),
    fixedFinishes: proposal.fixedFinishes?.map((_, index) => index) };
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
  if (isTelevision(catalog) && hasRoomTelevision(doc, placement.room.id, rooms)) return;
  const elevationMm = (floorFinish(doc, placement.room.id).elevationMm ?? 0) + catalog.elevationMm;
  const furniture: Furniture = {
    id: newId(), kind: catalog.kind, catalogId: catalog.id, x: item.xMm, y: item.yMm,
    ...proposalSize(item, catalog), heightMm: catalog.heightMm,
    elevationMm, rotation: item.rotation, dimensionalOrigin: 'physical', color: catalog.color,
  };
  doc.furniture.push(placement.host ? restOnHost(doc, { ...furniture, hostId: placement.host.id,
    elevationMm: hostSurfaceTop(placement.host) }) : furniture);
}

/** Tramos de cocina de la propuesta; cada uno encaja sus aparatos dejando libre la esquina que comparte con otro. */
export function addSuggestedKitchens(doc: EditorDocument, kitchens: readonly NativeDesignKitchen[], rooms: ReturnType<typeof deriveRooms>, allowedRooms?: ReadonlySet<string>) {
  if (!kitchens.length) return;
  doc.kitchenRuns ??= [];
  const added = kitchens.flatMap((kitchen) => {
    if (kitchenPlacementIssue(doc, kitchen, rooms, allowedRooms)) return [];
    const run = kitchenRun(doc, kitchen);
    doc.kitchenRuns!.push(run);
    return [{ run, appliances: kitchen.appliances }];
  });
  for (const { run, appliances } of added) fitKitchenSlots(run, appliances, doc.kitchenRuns);
}

function kitchenRun(doc: EditorDocument, kitchen: NativeDesignKitchen) {
  const run = proposalKitchenRun(kitchen);
  run.elevationMm = floorElevationAt(doc, localToWorld(run, { x: run.widthMm / 2, y: run.depthMm / 2 }));
  return run;
}

/** Un tramo de cocina cabe si queda dentro de una estancia elegida, deja libres puertas y escaleras y no atraviesa nada. */
export function kitchenPlacementIssue(doc: EditorDocument, kitchen: NativeDesignKitchen, rooms = deriveRooms(doc),
  allowedRooms?: ReadonlySet<string>): NativeFurniturePlacementIssue | null {
  if (!(kitchen.lengthMm >= MIN_KITCHEN_MM) || ![kitchen.xMm, kitchen.yMm, kitchen.rotation].every(Number.isFinite)) return 'catalog';
  const candidate = { x: kitchen.xMm, y: kitchen.yMm, widthMm: kitchen.lengthMm, depthMm: KITCHEN_DEPTH_MM, rotation: kitchen.rotation };
  const footprint = corners(candidate);
  const room = rooms.filter((item) => footprint.every((point) => contains(item.boundary, point))).sort((a, b) => a.areaMm2 - b.areaMm2)[0];
  if (!room || (allowedRooms && !allowedRooms.has(room.id))) return 'room';
  if ([...(doc.stairs ?? []), ...(doc.ramps ?? [])].some((target) => intersects(candidate, target, CIRCULATION_MM))
    || doc.openings.some((opening) => { const zone = opening.kind !== 'ventana' ? doorKeepOut(doc, opening) : null; return !!zone && intersects(candidate, zone, DOOR_CLEARANCE_MM); }))
    return 'circulation';
  try { assertSpatialPlacement(doc, { ...doc, kitchenRuns: [...(doc.kitchenRuns ?? []), kitchenRun(doc, kitchen)] }); }
  catch (error) { return error instanceof Error && /la pared/.test(error.message) ? 'wall' : 'collision'; }
  return null;
}

/** Como una pieza de pared, el tramo se acorta por un extremo o por los dos hasta que cabe, sin despegarse del muro. */
export function settleNativeDesignKitchen(doc: EditorDocument, kitchen: NativeDesignKitchen, rooms = deriveRooms(doc),
  allowedRooms?: ReadonlySet<string>): { kitchen: NativeDesignKitchen; issue: NativeFurniturePlacementIssue | null } {
  const issue = kitchenPlacementIssue(doc, kitchen, rooms, allowedRooms);
  if (!issue || issue === 'catalog') return { kitchen, issue };
  const angle = kitchen.rotation * Math.PI / 180, direction = { x: Math.cos(angle), y: Math.sin(angle) };
  for (let trim = SETTLE_STEP_MM; kitchen.lengthMm - trim >= MIN_KITCHEN_MM && trim <= SLIDE_REACH_MM; trim += SETTLE_STEP_MM)
    for (const start of [0, trim, trim / 2]) {
      const moved = { ...kitchen, lengthMm: kitchen.lengthMm - trim, xMm: kitchen.xMm + direction.x * start, yMm: kitchen.yMm + direction.y * start };
      if (!kitchenPlacementIssue(doc, moved, rooms, allowedRooms)) return { kitchen: moved, issue: null };
    }
  return { kitchen, issue };
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

/** Paso libre alrededor de escaleras y rampas; delante de una puerta, lo que su hoja necesita más este margen. */
const CIRCULATION_MM = 1000, DOOR_APPROACH_MM = 200, DOOR_CLEARANCE_MM = 100;
/** Plantas, jardineras y lámparas de suelo van junto a un borde: a más de esta distancia de todo límite estorban en mitad del espacio. */
export const EDGE_REACH_MM = 900;
const EDGE_PROFILES = new Set(['plant', 'outdoor', 'lamp', 'toilet', 'sink', 'shower', 'bath', 'kitchen', 'appliance']);
/** Piezas que en una vivienda van juntas: módulos y aparatos de cocina, sanitarios, armarios, mesillas y camas pueden tocarse sin solaparse. */
const FITTED_PROFILES = new Set(['toilet', 'sink', 'shower', 'bath', 'kitchen', 'appliance', 'cabinet', 'bed']);
/**
 * Sillas y bancos se arriman a su mesa y entre sí; el banco, a los pies de la cama; los taburetes, a la isla o la
 * península de la cocina. Con 250 mm no cabía ninguna silla.
 */
const PAIRED_PROFILES: readonly (readonly [string, string])[] = [['chair', 'table'], ['chair', 'chair'], ['chair', 'kitchen'], ['bench', 'table'], ['bench', 'bed']];
function tucked(profile: string, item: { x: number; y: number; widthMm: number; depthMm: number; rotation: number },
  otherProfile: string, other: { x: number; y: number; widthMm: number; depthMm: number; rotation: number }): boolean {
  const [chair, table] = profile === 'chair' && otherProfile === 'table' ? [item, other] : profile === 'table' && otherProfile === 'chair' ? [other, item] : [];
  if (!chair || !table) return false;
  const centre = localToWorld(chair, { x: chair.widthMm / 2, y: chair.depthMm / 2 }), box = bounds(corners(table));
  return !(centre.x > box.minX && centre.x < box.maxX && centre.y > box.minY && centre.y < box.maxY);
}
function canTouch(a: string, b: string): boolean {
  return (FITTED_PROFILES.has(a) && FITTED_PROFILES.has(b)) || PAIRED_PROFILES.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}
/**
 * Lo que la IA apoya sobre otro mueble es pequeño (una lámpara de mesa, un jarrón) y va sobre un tablero bajo: mesilla,
 * mesa, aparador o encimera. El editor deja apoyar una planta en una cama; en una propuesta salía una planta encima de
 * la cama o de un armario.
 */
const HOSTED_MAX_MM = 600, HOST_TOP_MAX_MM = 1100;
const PROPOSAL_HOST_PROFILES = new Set(['cabinet', 'table', 'shelf', 'kitchen']);
function proposalHost(target: Furniture, floorMm: number): boolean {
  const profile = getFurnitureCatalogEntry(target.catalogId ?? '')?.profile ?? '';
  return (isKitchenRun(target) || PROPOSAL_HOST_PROFILES.has(profile)) && hostSurfaceTop(target) - floorMm <= HOST_TOP_MAX_MM;
}
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

/**
 * Zona que una puerta necesita libre: el ancho del hueco y, a cada lado del muro, la profundidad de su hoja más un paso.
 * Antes era un cuadrado con 800 mm de margen en todas direcciones; en un dormitorio de 3 m no dejaba sitio a la cama.
 * Una corredera vista reserva además el tramo de pared donde se recoge su hoja (a los dos lados si son dos hojas al centro).
 */
function doorKeepOut(doc: EditorDocument, opening: EditorDocument['openings'][number]) {
  const wall = doc.walls.find((item) => item.id === opening.wallId);
  if (!wall) return null;
  const path = wallPath(doc, wall), centre = path.at(opening.position), tangent = path.tangent(opening.position);
  // Un paso sin puerta no tiene hoja que abrir: basta un metro de paso a cada lado, aunque sea muy ancho.
  const normal = { x: -tangent.y, y: tangent.x }, parking = slideParkingMm({ ...opening, hinge: openingConstruction(opening).hinge });
  const width = opening.widthMm + parking.start + parking.end, start = opening.widthMm / 2 + parking.start;
  const depth = (opening.kind === 'puerta' ? leafReachMm(opening) : Math.min(opening.widthMm, CIRCULATION_MM - DOOR_APPROACH_MM)) + DOOR_APPROACH_MM;
  return { x: centre.x - tangent.x * start - normal.x * depth, y: centre.y - tangent.y * start - normal.y * depth,
    widthMm: width, depthMm: depth * 2, rotation: Math.atan2(tangent.y, tangent.x) * 180 / Math.PI };
}

/** Rectángulos que cada puerta necesita libres, con el margen con que los comprueba la validación: se le dan a la IA. */
export function doorClearZones(doc: EditorDocument): { minX: number; minY: number; maxX: number; maxY: number }[] {
  return doc.openings.flatMap((opening) => {
    const zone = opening.kind !== 'ventana' ? doorKeepOut(doc, opening) : null;
    if (!zone) return [];
    const box = bounds(corners(zone));
    return [{ minX: box.minX - DOOR_CLEARANCE_MM, minY: box.minY - DOOR_CLEARANCE_MM, maxX: box.maxX + DOOR_CLEARANCE_MM, maxY: box.maxY + DOOR_CLEARANCE_MM }];
  });
}

/**
 * La IA coloca como un interiorista, no al milímetro: una cama arrimada al muro le entra unos centímetros en la pared y
 * una silla queda a un dedo de la mesa. Antes de rechazar una pieza se busca el sitio válido más cercano, como haría
 * quien la arrastra en el editor; lo que no cabe a esta distancia sigue rechazado y la IA lo corrige.
 */
const SETTLE_REACH_MM = 400, SETTLE_STEP_MM = 50;
const SETTLE_OFFSETS = (() => {
  const steps = Math.round(SETTLE_REACH_MM / SETTLE_STEP_MM), offsets: Point[] = [];
  for (let i = -steps; i <= steps; i++) for (let j = -steps; j <= steps; j++)
    if ((i || j) && Math.hypot(i, j) <= steps) offsets.push({ x: i * SETTLE_STEP_MM, y: j * SETTLE_STEP_MM });
  return offsets.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
})();
/** Fallos que un desplazamiento corto no arregla: otra ficha u otro ambiente. */
const UNSETTLED_ISSUES = new Set<NativeFurniturePlacementIssue>(['catalog', 'environment']);
/** Una lámpara de mesa sin mueble debajo se pone en la mesilla, mesa o aparador libre más cercano de su estancia. */
const SUPPORT_REACH_MM = 2500;

/** Una pieza arrimada a una pared se desliza primero a lo largo de ella, para no despegarla del muro. */
const SLIDE_REACH_MM = 1500;

export function settleNativeDesignFurniture(
  doc: EditorDocument, item: NativeDesignFurniture, rooms = deriveRooms(doc),
  allowedRooms?: ReadonlySet<string>, zonePolygon?: Point[], along?: Point,
): { item: NativeDesignFurniture; issue: NativeFurniturePlacementIssue | null } {
  const issue = assessFurniturePlacement(doc, item, rooms, allowedRooms, zonePolygon).issue;
  if (!issue || UNSETTLED_ISSUES.has(issue)) return { item, issue };
  if (issue === 'support') {
    const catalog = getFurnitureCatalogEntry(item.catalogId)!, size = { widthMm: catalog.widthMm, depthMm: catalog.depthMm };
    const centre = objectCenter({ x: item.xMm, y: item.yMm, rotation: item.rotation, ...size });
    const hosts = planObjects(doc).filter(isSurfaceHost).map((host) => ({ host, centre: objectCenter(host) }))
      .map((entry) => ({ ...entry, distance: Math.hypot(entry.centre.x - centre.x, entry.centre.y - centre.y) }))
      .filter(({ distance }) => distance <= SUPPORT_REACH_MM).sort((a, b) => a.distance - b.distance);
    for (const { host, centre: target } of hosts) {
      const offset = objectCenter({ x: 0, y: 0, rotation: host.rotation, ...size });
      const moved = { ...item, rotation: host.rotation, xMm: target.x - offset.x, yMm: target.y - offset.y };
      if (!assessFurniturePlacement(doc, moved, rooms, allowedRooms, zonePolygon).issue) return { item: moved, issue: null };
    }
    return { item, issue };
  }
  const slides = along ? Array.from({ length: 2 * SLIDE_REACH_MM / SETTLE_STEP_MM }, (_, index) => {
    const distance = SETTLE_STEP_MM * Math.ceil((index + 1) / 2) * (index % 2 ? -1 : 1);
    return { x: along.x * distance, y: along.y * distance };
  }) : [];
  for (const offset of [...slides, ...SETTLE_OFFSETS]) {
    const moved = { ...item, xMm: item.xMm + offset.x, yMm: item.yMm + offset.y };
    if (!assessFurniturePlacement(doc, moved, rooms, allowedRooms, zonePolygon).issue) return { item: moved, issue: null };
  }
  return { item, issue };
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
  const candidate = { x: item.xMm, y: item.yMm, ...proposalSize(item, catalog), rotation: item.rotation };
  const room = suggestedFurnitureRoom(item, rooms);
  if (!room || (allowedRooms && !allowedRooms.has(room.id))) return { issue: 'room' };
  if (zonePolygon && !polygonContainsFootprint(zonePolygon, corners(candidate))) return { issue: 'zone' };
  // Un objeto de interior (lámpara de pie, planta de salón…) no se coloca al aire libre.
  const indoor = eligibleCeilingRooms(doc).some((item) => item.id === room.id);
  if (!indoor && INDOOR_ONLY_ROOMS.has(catalog.room) && !/exterior|outdoor|jardin/.test(catalog.id)) return { issue: 'environment' };
  // El paso a escaleras, rampas y puertas queda libre, no solo sin solapes. Una alfombra no estorba a la hoja de una puerta.
  const passages = [...(doc.stairs ?? []), ...(doc.ramps ?? [])].some((target) => intersects(candidate, target, CIRCULATION_MM))
    || catalog.profile !== 'rug' && doc.openings.some((opening) => {
      if (opening.kind === 'ventana') return false;
      const zone = doorKeepOut(doc, opening);
      return !!zone && intersects(candidate, zone, DOOR_CLEARANCE_MM);
    });
  if (passages) return { issue: 'circulation' };
  const candidateItem: Furniture = { id: '__design_candidate', kind: catalog.kind, catalogId: catalog.id,
    ...candidate, heightMm: catalog.heightMm, elevationMm: 0, color: catalog.color,
    dimensionalOrigin: 'physical' };
  const floor = floorFinish(doc, room.id).elevationMm ?? 0;
  // Lo pequeño se apoya; una pantalla también, aunque mida más: la tele va sobre su mueble.
  const host = canRestOnHost(candidateItem) && (catalog.heightMm <= HOSTED_MAX_MM || catalog.profile === 'screen') ? planObjects(doc)
    .filter((target) => isSurfaceHost(target) && proposalHost(target, floor) && canFitOnHost(candidateItem, target)
      && polygonContainsFootprint(corners(target), corners(candidate)))
    .sort((a, b) => hostSurfaceTop(b) - hostSurfaceTop(a))[0] : undefined;
  if (catalog.profile === 'lamp' && catalog.elevationMm > 0 && !host) return { issue: 'support' };
  // Plantas y lámparas de suelo, pegadas a un muro o al borde de la zona; en mitad del espacio estorban.
  if (!host && EDGE_PROFILES.has(catalog.profile) && !catalog.id.includes('tira-led') && !catalog.id.includes('isla')) {
    const boundary = zonePolygon ?? room.boundary;
    if (corners(candidate).every((point) => distanceToBoundary(boundary, point) > EDGE_REACH_MM)) return { issue: 'edge' };
  }
  const bottom = host ? hostSurfaceTop(host) : floor + catalog.elevationMm;
  const shelters = doc.furniture.filter((target) => ['porche-entrada', 'carpa', 'pergola', 'pergola-aluminio', 'pergola-metal'].includes(target.kind));
  const shelterIds = new Set(shelters.map((target) => target.id));
  // Una alfombra va bajo el mobiliario: solo otra alfombra le estorba, y ella no estorba a nadie.
  const isRug = (target: { catalogId?: string }) => getFurnitureCatalogEntry(target.catalogId ?? '')?.profile === 'rug';
  const blockedByObject = planObjects(doc).filter((target) => !shelterIds.has(target.id)
    && (catalog.profile === 'rug' ? isRug(target) : !isRug(target))).some((target) => {
    if (host && (target.id === host.id || (target.elevationMm ?? 0) + (target.heightMm ?? 0) <= bottom)) return false;
    const targetProfile = getFurnitureCatalogEntry(target.catalogId ?? '')?.profile ?? '';
    // Una silla se mete en parte bajo su mesa, como en cualquier comedor; nunca con el asiento entero debajo.
    if (tucked(catalog.profile, candidate, targetProfile, target)) return false;
    // Lo apoyado en un tablero solo tiene que caber en él: la lámpara de la mesilla queda a un palmo del cabecero.
    // Un sofá en L choca por sus dos tramos, no por el rectángulo que los envuelve: su hueco es para la mesa de centro.
    // Una planta se arrima a un mueble sin el paso de 25 cm: en un rincón junto al sofá o la TV no cabía ninguna.
    const clearance = host || canTouch(catalog.profile, targetProfile) ? 0 : catalog.profile === 'plant' || targetProfile === 'plant' ? 50 : 250;
    return planParts(targetProfile, target.widthMm, target.depthMm).some((part) => {
      const origin = localToWorld(target, { x: part.x, y: part.y });
      return intersects(candidate, { x: origin.x, y: origin.y, widthMm: part.widthMm, depthMm: part.depthMm, rotation: target.rotation }, clearance);
    });
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
  const candidate = { x: item.xMm, y: item.yMm, ...proposalSize(item, catalog), rotation: item.rotation };
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
