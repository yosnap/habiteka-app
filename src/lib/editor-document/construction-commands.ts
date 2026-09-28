import type { Column, EditorDocument, Opening, Ramp, Stair, Wall } from './schema';
import { upgradeConstructionDocument } from './migrations';
import { parseEditorDocument } from './validation';
import { finishColor, transformAroundCenter, upgradeRampDocument, upgradeSpatialDocument } from './spatial-properties';
import { assertOpeningClearance } from './opening-clearance';
import { wallConstruction } from './construction-properties';
import { floorFinish, normalizeRoomWallBases } from './floor-finishes';
import { rampArrival, rampArrivalTarget } from './ramp-arrival';
import { isRampLanding } from './ramp-kind';
import { landingEntranceTarget } from './landing-entrance';
import { placeLandingAtHosts } from './landing-hosts';
import { surfaceMaterial } from './surface-materials';

function update(input: EditorDocument, operation: (doc: EditorDocument) => void): EditorDocument {
  const doc = upgradeConstructionDocument(input);
  operation(doc);
  return parseEditorDocument(doc);
}
export function setWallConstruction(input: EditorDocument, id: string,
  patch: Pick<Wall, 'heightMm' | 'materials' | 'baseElevationMm'>): EditorDocument {
  return update(input, (doc) => {
    const wall = doc.walls.find((entity) => entity.id === id);
    if (!wall) throw new Error('Muro no encontrado');
    Object.assign(wall, patch);
    const ceilingMm = (wall.baseElevationMm ?? 0) + wallConstruction(wall).heightMm;
    doc.openings.filter((opening) => opening.wallId === id && opening.sourceRampId).forEach((opening) => {
      const heightMm = ceilingMm - (opening.elevationMm ?? 0);
      if (heightMm <= 0) throw new Error('El muro queda por debajo de la llegada automática de la rampa.');
      opening.heightMm = heightMm;
    });
    if (doc.schemaVersion >= 4 && patch.materials) wall.colors = { left: finishColor(patch.materials.left), right: finishColor(patch.materials.right) };
  });
}
/** A hidden wall remains in the room graph, but is not a physical rendered wall. */
export function setWallVisibility(input: EditorDocument, id: string, hidden: boolean): EditorDocument {
  return update(input, (doc) => {
    const wall = doc.walls.find((entity) => entity.id === id);
    if (!wall) throw new Error('Muro no encontrado');
    wall.hidden = hidden || undefined;
  });
}
export function setOpeningConstruction(input: EditorDocument, id: string,
  patch: Partial<Pick<Opening, 'heightMm' | 'elevationMm' | 'catalogId' | 'hinge' | 'swing' | 'openAngleDeg'>>): EditorDocument {
  return update(input, (doc) => {
    const opening = doc.openings.find((entity) => entity.id === id);
    if (!opening) throw new Error('Abertura no encontrada');
    Object.assign(opening, patch);
  });
}
export function addStair(input: EditorDocument, stair: Stair): EditorDocument {
  return update(input, (doc) => { doc.stairs!.push({ ...structuredClone(stair),
    ...(doc.schemaVersion >= 4 ? { color: stair.color ?? finishColor(stair.materialId) } : {}) }); });
}
export function addColumn(input: EditorDocument, column: Column): EditorDocument {
  return update(upgradeRampDocument(input), (doc) => { doc.columns ??= []; doc.columns.push(structuredClone(column)); });
}
export function updateColumn(input: EditorDocument, id: string, patch: Partial<Omit<Column, 'id'>>): EditorDocument {
  return update(upgradeRampDocument(input), (doc) => {
    const column = doc.columns?.find((item) => item.id === id); if (!column) throw new Error('Columna no encontrada');
    Object.assign(column, transformAroundCenter(column, patch));
    if (patch.materialId) column.color = surfaceMaterial(patch.materialId) ? '#ffffff' : finishColor(patch.materialId);
  });
}
export function updateStair(input: EditorDocument, id: string, patch: Partial<Omit<Stair, 'id'>>): EditorDocument {
  return update(upgradeSpatialDocument(input), (doc) => {
    const stair = doc.stairs!.find((entity) => entity.id === id);
    if (!stair) throw new Error('Escalera no encontrada');
    Object.assign(stair, transformAroundCenter(stair, patch));
    if (doc.schemaVersion >= 4 && patch.materialId) stair.color = finishColor(patch.materialId);
  });
}
export function removeStair(input: EditorDocument, id: string): EditorDocument {
  return update(input, (doc) => {
    if (!doc.stairs!.some((entity) => entity.id === id)) throw new Error('Escalera no encontrada');
    doc.stairs = doc.stairs!.filter((entity) => entity.id !== id);
    if (doc.comments) doc.comments = doc.comments.filter((c) => c.targetEntityId !== id);
  });
}
export function addRamp(input: EditorDocument, ramp: Ramp): EditorDocument {
  const doc = upgradeRampDocument(input);
  doc.ramps!.push({ ...structuredClone(ramp), color: ramp.color ?? finishColor(ramp.materialId) });
  return syncRampArrival(doc, ramp.id);
}
export function updateRamp(input: EditorDocument, id: string, patch: Partial<Omit<Ramp, 'id'>>): EditorDocument {
  const doc = upgradeRampDocument(input), ramp = doc.ramps!.find((entity) => entity.id === id);
  if (!ramp) throw new Error('Rampa no encontrada');
  Object.assign(ramp, transformAroundCenter(ramp, patch));
  if ('bodyMaterialId' in patch && patch.bodyMaterialId === undefined) delete ramp.bodyMaterialId;
  if (patch.materialId) ramp.color = finishColor(patch.materialId);
  if (isRampLanding(ramp)) {
    if (patch.widthMm !== undefined || patch.depthMm !== undefined || patch.elevationMm !== undefined) keepLandingAttached(doc, ramp);
    return syncLandingEntrance(doc, id);
  }
  return syncRampArrival(doc, id);
}

/** A resize must not break an existing ramp-to-landing junction. Position edits remain deliberate. */
function keepLandingAttached(doc: EditorDocument, landing: Ramp): void {
  // Una rampa y una escalera que llegan juntas cuentan como una sola llegada: el descansillo las remata a ambas.
  const host = placeLandingAtHosts(doc, landing, 1000, (placed) => Math.hypot(placed.x - landing.x, placed.y - landing.y));
  if (host) Object.assign(landing, host);
}
export function removeRamp(input: EditorDocument, id: string): EditorDocument {
  const doc = upgradeRampDocument(input);
  if (!doc.ramps!.some((entity) => entity.id === id)) throw new Error('Rampa no encontrada');
  doc.ramps = doc.ramps!.filter((entity) => entity.id !== id);
  doc.openings = doc.openings.filter((opening) => opening.sourceRampId !== id);
  if (doc.comments) doc.comments = doc.comments.filter((comment) => comment.targetEntityId !== id);
  return parseEditorDocument(doc);
}

/** Makes the ramp arrive at the raised floor and cuts the matching wall opening in one command. */
export function connectRampArrival(input: EditorDocument, id: string): EditorDocument {
  const doc = upgradeRampDocument(input), ramp = doc.ramps!.find((entity) => entity.id === id);
  if (!ramp) throw new Error('Rampa no encontrada');
  const target = rampArrivalTarget(doc, ramp);
  if (!target) throw new Error('Acerca el extremo de salida de la rampa a una pared de una habitación cerrada.');
  const arrival = rampArrival(ramp), wallHeightMm = wallConstruction(target.wall).heightMm;
  normalizeRoomWallBases(doc, target.room.id);
  const openingHeightMm = wallHeightMm - arrival.elevationMm;
  if (openingHeightMm <= 0) throw new Error('La llegada de la rampa queda por encima de la altura del muro.');
  doc.openings = doc.openings.filter((opening) => opening.sourceRampId !== ramp.id);
  const opening: Opening = { id: crypto.randomUUID(), wallId: target.wall.id, kind: 'hueco', position: target.position,
    widthMm: ramp.widthMm, dimensionalOrigin: 'physical', heightMm: openingHeightMm,
    elevationMm: arrival.elevationMm, catalogId: 'auto:ramp-arrival', hinge: 'left', swing: 'left', openAngleDeg: 0,
    colors: { frame: '#f4f1e9', leaf: '#bb956c' }, sourceRampId: ramp.id };
  assertOpeningClearance(doc, opening);
  doc.openings.push(opening);
  doc.floorFinishes = [...doc.floorFinishes!.filter((finish) => finish.roomId !== target.room.id),
    { ...floorFinish(doc, target.room.id), roomId: target.room.id, elevationMm: arrival.elevationMm }];
  doc.revision += 1;
  return parseEditorDocument(doc);
}

/** Cuts a doorless wall opening from the landing elevation to the wall top. */
export function connectLandingEntrance(input: EditorDocument, id: string): EditorDocument {
  const doc = upgradeRampDocument(input), landing = doc.ramps!.find((entity) => entity.id === id);
  if (!landing || !isRampLanding(landing)) throw new Error('Selecciona un descansillo');
  const target = landingEntranceTarget(doc, landing);
  if (!target) throw new Error('Acerca un borde del descansillo a una pared para abrir la entrada.');
  const heightMm = wallConstruction(target.wall).heightMm - landing.elevationMm;
  if (heightMm <= 0) throw new Error('El descansillo queda por encima de la altura del muro.');
  doc.openings = doc.openings.filter((opening) => opening.sourceRampId !== landing.id);
  const opening: Opening = { id: crypto.randomUUID(), wallId: target.wall.id, kind: 'hueco', position: target.position,
    widthMm: target.widthMm, dimensionalOrigin: 'physical', heightMm, elevationMm: landing.elevationMm,
    catalogId: 'auto:landing-entrance', hinge: 'left', swing: 'left', openAngleDeg: 0,
    colors: { frame: '#f4f1e9', leaf: '#bb956c' }, sourceRampId: landing.id };
  assertOpeningClearance(doc, opening);
  doc.openings.push(opening);
  doc.revision += 1;
  return parseEditorDocument(doc);
}

/** Keeps an automatic arrival synchronized while the ramp is moved or resized. */
export function syncRampArrival(input: EditorDocument, id: string): EditorDocument {
  const doc = upgradeRampDocument(input), ramp = doc.ramps!.find((entity) => entity.id === id);
  if (!ramp) throw new Error('Rampa no encontrada');
  if (isRampLanding(ramp)) return parseEditorDocument(doc);
  if (rampArrivalTarget(doc, ramp)) return connectRampArrival(doc, id);
  if (!doc.openings.some((opening) => opening.sourceRampId === id)) return parseEditorDocument(doc);
  doc.openings = doc.openings.filter((opening) => opening.sourceRampId !== id);
  doc.revision += 1;
  return parseEditorDocument(doc);
}

/** An automatic landing entrance follows its host while the landing remains against a wall. */
function syncLandingEntrance(input: EditorDocument, id: string): EditorDocument {
  const doc = upgradeRampDocument(input), landing = doc.ramps!.find((entity) => entity.id === id);
  if (!landing) throw new Error('Rampa no encontrada');
  if (!doc.openings.some((opening) => opening.sourceRampId === id)) return parseEditorDocument(doc);
  if (landingEntranceTarget(doc, landing)) return connectLandingEntrance(doc, id);
  doc.openings = doc.openings.filter((opening) => opening.sourceRampId !== id);
  doc.revision += 1;
  return parseEditorDocument(doc);
}
