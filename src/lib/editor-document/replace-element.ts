import type { EditorDocument, Furniture } from './schema';
import type { FurnitureCatalogEntry } from './furniture-catalog';
import { objectCenter, upgradeSpatialDocument } from './spatial-properties';
import { parseEditorDocument } from './validation';
import { isElementLocked } from './element-locks';
import { canFitOnHost } from './object-host-rest';
import { planObjects, isBoundaryKind } from './boundary-types';

/** Sustitución atómica: mismo centro, giro e identidad; dimensiones y acabados del nuevo modelo. */
export function replaceFurniture(source: EditorDocument, id: string, item: FurnitureCatalogEntry): EditorDocument {
  if (isElementLocked(source, id)) throw new Error('Desbloquea el elemento o su grupo antes de sustituirlo.');
  const doc = upgradeSpatialDocument(source), index = doc.furniture.findIndex(entry => entry.id === id);
  if (index < 0 || isBoundaryKind(item.kind)) throw new Error('Elige un modelo compatible con este elemento.');
  const original = doc.furniture[index]!, center = objectCenter(original);
  const replacement: Furniture = { id, name: original.name, catalogId: item.id, kind: item.kind,
    x: 0, y: 0, rotation: original.rotation, widthMm: item.widthMm, depthMm: item.depthMm,
    heightMm: item.heightMm, elevationMm: original.elevationMm ?? item.elevationMm,
    color: item.color, dimensionalOrigin: 'physical' };
  const offset = objectCenter(replacement);
  replacement.x = center.x - offset.x; replacement.y = center.y - offset.y;
  if (original.hostId) {
    const host = planObjects(doc).find(entry => entry.id === original.hostId);
    if (!host || !canFitOnHost(replacement, host)) throw new Error('El nuevo modelo no cabe sobre el soporte del original.');
    replacement.hostId = original.hostId;
  }
  for (const child of doc.furniture.filter(entry => entry.hostId === id))
    if (!canFitOnHost(child, replacement)) throw new Error('El nuevo modelo no admite los objetos apoyados encima. Retíralos antes de sustituirlo.');
  doc.furniture[index] = replacement;
  return parseEditorDocument(doc);
}
