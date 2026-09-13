import type { EditorDocument, Opening, Ramp, Stair, Wall } from './schema';
import { upgradeConstructionDocument } from './migrations';
import { parseEditorDocument } from './validation';
import { finishColor, transformAroundCenter, upgradeRampDocument, upgradeSpatialDocument } from './spatial-properties';
import { assertOpeningClearance } from './opening-clearance';
import { wallConstruction } from './construction-properties';
import { floorFinish, setRoomFloorElevation } from './floor-finishes';
import { rampArrival, rampArrivalTarget } from './ramp-arrival';

function update(input: EditorDocument, operation: (doc: EditorDocument) => void): EditorDocument {
  const doc = upgradeConstructionDocument(input);
  operation(doc);
  return parseEditorDocument(doc);
}
export function setWallConstruction(input: EditorDocument, id: string,
  patch: Pick<Wall, 'heightMm' | 'materials'>): EditorDocument {
  return update(input, (doc) => {
    const wall = doc.walls.find((entity) => entity.id === id);
    if (!wall) throw new Error('Muro no encontrado');
    Object.assign(wall, patch);
    if (doc.schemaVersion >= 4 && patch.materials) wall.colors = { left: finishColor(patch.materials.left), right: finishColor(patch.materials.right) };
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
  if (patch.materialId) ramp.color = finishColor(patch.materialId);
  return syncRampArrival(doc, id);
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
  setRoomFloorElevation(doc, target.room.id, arrival.elevationMm);
  doc.openings = doc.openings.filter((opening) => opening.sourceRampId !== ramp.id);
  const opening: Opening = { id: crypto.randomUUID(), wallId: target.wall.id, kind: 'hueco', position: target.position,
    widthMm: ramp.widthMm, dimensionalOrigin: 'physical', heightMm: wallHeightMm,
    elevationMm: arrival.elevationMm, catalogId: 'auto:ramp-arrival', hinge: 'left', swing: 'left', openAngleDeg: 0,
    colors: { frame: '#f4f1e9', leaf: '#bb956c' }, sourceRampId: ramp.id };
  assertOpeningClearance(doc, opening);
  doc.openings.push(opening);
  doc.floorFinishes = [...doc.floorFinishes!.filter((finish) => finish.roomId !== target.room.id),
    { ...floorFinish(doc, target.room.id), roomId: target.room.id, elevationMm: arrival.elevationMm }];
  doc.revision += 1;
  return parseEditorDocument(doc);
}

/** Keeps an automatic arrival synchronized while the ramp is moved or resized. */
export function syncRampArrival(input: EditorDocument, id: string): EditorDocument {
  const doc = upgradeRampDocument(input), ramp = doc.ramps!.find((entity) => entity.id === id);
  if (!ramp) throw new Error('Rampa no encontrada');
  if (rampArrivalTarget(doc, ramp)) return connectRampArrival(doc, id);
  if (!doc.openings.some((opening) => opening.sourceRampId === id)) return parseEditorDocument(doc);
  doc.openings = doc.openings.filter((opening) => opening.sourceRampId !== id);
  doc.revision += 1;
  return parseEditorDocument(doc);
}
