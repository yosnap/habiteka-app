import { upgradeWalkthroughDocument } from './walkthrough';
import { emptyEditorDocument, type EditorDocument } from './schema';
import { upgradeCeilingDocument } from './ceiling-commands';
import { upgradeLightingDocument } from './lighting-migration';
import { upgradeSpatialDocument } from './spatial-properties';
import { parseEditorDocument } from './validation';

/** Old commands remain scoped to root arrays; never duplicate the active document. */
export function levelDocument(input: EditorDocument): EditorDocument {
  const copy = structuredClone(input); delete copy.levels; delete copy.activeLevelId; delete copy.geographicSite;
  return copy;
}
function building(input: EditorDocument): EditorDocument {
  const doc = upgradeSpatialDocument(input); if (doc.schemaVersion < 5) doc.schemaVersion = 5; doc.floorFinishes ??= [];
  if (!doc.levels) {
    doc.activeLevelId = crypto.randomUUID();
    doc.levels = [{ id: doc.activeLevelId, name: 'Planta baja', heightMm: Math.max(2700, ...doc.walls.map((w) => w.heightMm ?? 2700)) }];
  }
  return doc;
}
export function switchBuildingLevel(input: EditorDocument, id: string): EditorDocument {
  const doc = parseEditorDocument(input);
  if (id === doc.activeLevelId) return doc;
  const target = doc.levels?.find((l) => l.id === id), current = doc.levels?.find((l) => l.id === doc.activeLevelId);
  if (!target?.document || !current) throw new Error('Planta inexistente');
  const content = target.document;
  current.document = levelDocument(doc); delete target.document;
  return parseEditorDocument({ ...content, schemaVersion: Math.max(5, content.schemaVersion), floorFinishes: content.floorFinishes ?? [],
    levels: doc.levels, activeLevelId: id, geographicSite: doc.geographicSite, revision: doc.revision + 1 });
}
export function addBuildingLevel(input: EditorDocument, copyActive = false): EditorDocument {
  const doc = building(input), id = crypto.randomUUID();
  let content = copyActive ? levelDocument(doc) : upgradeSpatialDocument(emptyEditorDocument());
  if (doc.schemaVersion >= 8) content = upgradeCeilingDocument(content);
  if (doc.schemaVersion >= 9) content = upgradeWalkthroughDocument(content);
  if (doc.schemaVersion >= 12) content = upgradeLightingDocument(content);
  if (content.schemaVersion < 5) content.schemaVersion = 5; content.floorFinishes ??= [];
  doc.levels!.push({ id, name: `Planta ${doc.levels!.length}`, heightMm: doc.levels!.find((l) => l.id === doc.activeLevelId)!.heightMm, document: content });
  return switchBuildingLevel(doc, id);
}
export function updateBuildingLevel(input: EditorDocument, id: string, patch: { name?: string; heightMm?: number }): EditorDocument {
  const doc = parseEditorDocument(input), level = doc.levels?.find((l) => l.id === id);
  if (!level) throw new Error('Planta inexistente');
  if (patch.heightMm !== undefined) {
    const content = id === doc.activeLevelId ? doc : level.document!;
    content.walls.forEach((wall) => { if (wall.heightMm === level.heightMm) wall.heightMm = patch.heightMm; });
  }
  Object.assign(level, patch); doc.revision += 1;
  return parseEditorDocument(doc);
}
export function removeBuildingLevel(input: EditorDocument, id: string): EditorDocument {
  let doc = parseEditorDocument(input);
  if (!doc.levels || doc.levels.length < 2) throw new Error('Conserva al menos una planta');
  if (!doc.levels.some((l) => l.id === id)) throw new Error('Planta inexistente');
  if (doc.activeLevelId === id) doc = switchBuildingLevel(doc, doc.levels.find((l) => l.id !== id)!.id);
  doc.levels = doc.levels!.filter((l) => l.id !== id); doc.revision += 1;
  return parseEditorDocument(doc);
}
export function buildingDocuments(doc: EditorDocument): { id: string; elevationMm: number; document: EditorDocument }[] {
  if (!doc.levels) return [{ id: 'ground', elevationMm: 0, document: doc }];
  let elevationMm = 0;
  return doc.levels.map((level) => {
    const isolated = level.id === doc.activeLevelId ? levelDocument(doc) : level.document!;
    // Proyección de lectura: conserva altura local sin volver a anidar el edificio.
    const document = isolated.schemaVersion >= 8 ? { ...isolated,
      levels: [{ id: level.id, name: level.name, heightMm: level.heightMm }], activeLevelId: level.id } : isolated;
    const result = { id: level.id, elevationMm, document };
    elevationMm += level.heightMm; return result;
  });
}
