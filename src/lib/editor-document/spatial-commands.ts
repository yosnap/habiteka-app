import { updateBoundary } from './boundary-commands';
import { LEAF_FINISH_APPEARANCE } from './opening-look';
import { planObjects, isBoundary } from './boundary-types';
import { isKitchenRun } from './kitchen-run-types';
import { updateKitchenRun } from './kitchen-run-commands';
import type { EditorDocument, Furniture, ElementComment } from './schema';
import { upgradeSpatialDocument, transformAroundCenter } from './spatial-properties';
import { parseEditorDocument } from './validation';
import { surfaceMaterial } from './surface-materials';
import { followHostedChildren } from './object-host-rest';

export function setWallSurface(input: EditorDocument, id: string, side: 'left' | 'right', materialId?: string): EditorDocument {
  if (materialId && !surfaceMaterial(materialId)) throw new Error('Material desconocido');
  const doc = upgradeSpatialDocument(input), wall = doc.walls.find((w) => w.id === id);
  if (!wall) throw new Error('Muro no encontrado');
  wall.materials![side] = materialId ?? 'plaster-white';
  // Selecting a photographed material starts untinted, without touching the other face.
  wall.colors![side] = materialId ? '#ffffff' : '#eeeae2';
  return parseEditorDocument(doc);
}

export function updateFurniture(input: EditorDocument, id: string, patch: Partial<Omit<Furniture, 'id'>>): EditorDocument {
  if (input.boundaries?.some((b) => b.id === id)) return updateBoundary(input, id, patch);
  if (input.kitchenRuns?.some((r) => r.id === id)) return updateKitchenRun(input, id, patch);
  const doc = upgradeSpatialDocument(input), index = doc.furniture.findIndex((f) => f.id === id);
  if (index < 0) throw new Error('Mueble no encontrado');
  const previous = doc.furniture[index]!;
  const next = transformAroundCenter<Furniture>(previous, patch);
  doc.furniture[index] = next;
  followHostedChildren(doc, previous, next);
  return parseEditorDocument(doc);
}
export function paintElement(input: EditorDocument, id: string, part: string, color: string): EditorDocument {
  const doc = upgradeSpatialDocument(input);
  const wall = doc.walls.find((w) => w.id === id), opening = doc.openings.find((o) => o.id === id);
  const object = planObjects(doc).find((f) => f.id === id) ?? doc.stairs?.find((s) => s.id === id) ?? doc.ramps?.find((r) => r.id === id);
  if (wall && (part === 'left' || part === 'right')) wall.colors![part] = color;
  else if (opening && (part === 'frame' || part === 'leaf')) {
    // Lo pintado manda sobre el acabado elegido. El marco de una puerta va a juego con su acabado: al pintarlo, la hoja
    // conserva el tono de ese acabado como color liso.
    if (opening.leafFinish && (part === 'leaf' || opening.kind === 'puerta')) {
      if (part === 'frame') opening.colors!.leaf = LEAF_FINISH_APPEARANCE[opening.leafFinish].swatch;
      delete opening.leafFinish;
    }
    if (part === 'frame') delete opening.frameFinish;
    opening.colors![part] = color;
  }
  else if (object && 'kind' in object && !('stepCount' in object) && isBoundary(object) && part === 'base') object.construction.baseColor = color;
  else if (object && 'kind' in object && !('stepCount' in object) && isBoundary(object) && part === 'posts') object.construction.postColor = color;
  else if (object && 'kind' in object && !('stepCount' in object) && isKitchenRun(object) && part === 'worktop') object.kitchen.worktopColor = color;
  else if (object && 'kind' in object && !('stepCount' in object) && isKitchenRun(object) && part === 'plinth') object.kitchen.plinthColor = color;
  else if (object && 'kind' in object && !('stepCount' in object) && isKitchenRun(object) && part === 'uppers' && object.kitchen.uppers) object.kitchen.uppers.color = color;
  else if (object && part === 'body') object.color = color;
  else throw new Error('Superficie no disponible');
  return parseEditorDocument(doc);
}
export function saveComment(input: EditorDocument, comment: ElementComment): EditorDocument {
  const doc = upgradeSpatialDocument(input), index = doc.comments!.findIndex((c) => c.id === comment.id);
  const value = { ...comment, text: comment.text.trim() };
  if (index < 0) doc.comments!.push(value); else doc.comments![index] = value;
  return parseEditorDocument(doc);
}
export function removeComment(input: EditorDocument, id: string): EditorDocument {
  const doc = upgradeSpatialDocument(input);
  doc.comments = doc.comments!.filter((c) => c.id !== id);
  return parseEditorDocument(doc);
}
