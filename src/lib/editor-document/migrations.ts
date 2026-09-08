import type { EditorDocument } from './schema';
import { parseEditorDocument } from './validation';
import { openingConstruction, wallConstruction } from './construction-properties';

/** Explicit user-command upgrade; reading or toggling views must not call this. */
export function upgradeConstructionDocument(input: EditorDocument): EditorDocument {
  const doc = parseEditorDocument(input);
  if (doc.schemaVersion >= 3) return doc;
  doc.schemaVersion = 3;
  doc.walls = doc.walls.map((wall) => ({ ...wall, ...wallConstruction(wall) }));
  doc.openings = doc.openings.map((opening) => ({ ...opening, ...openingConstruction(opening) }));
  doc.stairs = [];
  return parseEditorDocument(doc);
}
