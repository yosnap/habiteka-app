import type { EditorDocument } from './schema';
import { upgradeKitchenDocument } from './kitchen-run-commands';
import { parseEditorDocument } from './validation';

/**
 * Migración explícita a v12 (foco orientable, tiras LED, escenas y zonas de
 * luces): leer un plano antiguo nunca lo cambia, solo editarlo. Un único bump
 * para las cuatro funcionalidades, así no quedan estados intermedios.
 */
export function upgradeLightingDocument(source: EditorDocument): EditorDocument {
  const doc = upgradeKitchenDocument(source);
  if (doc.schemaVersion < 12) doc.schemaVersion = 12;
  doc.lightStrips ??= [];
  doc.lightingScenes ??= [];
  doc.lightZones ??= [];
  for (const level of doc.levels ?? [])
    if (level.document) level.document = upgradeLightingDocument(level.document);
  return parseEditorDocument(doc);
}
