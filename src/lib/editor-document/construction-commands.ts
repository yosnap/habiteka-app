import type { EditorDocument, Opening, Stair, Wall } from './schema';
import { upgradeConstructionDocument } from './migrations';
import { parseEditorDocument } from './validation';
import { finishColor, transformAroundCenter, upgradeSpatialDocument } from './spatial-properties';

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
