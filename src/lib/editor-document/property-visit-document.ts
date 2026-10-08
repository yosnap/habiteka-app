import type { EditorDocument } from './schema';

/** Estado escénico explícito del paseo; nunca persiste modificaciones en el plano aprobado. */
export function propertyVisitDocument(document: EditorDocument, openDoors: boolean) {
  const copy = structuredClone(document), openedDoorIds: string[] = [];
  const visit = (doc: EditorDocument) => {
    for (const opening of doc.openings) {
      if (openDoors && opening.kind === 'puerta' && (opening.openAngleDeg ?? 90) < 75) {
        opening.openAngleDeg = 90; openedDoorIds.push(opening.id);
      }
    }
    for (const level of doc.levels ?? []) if (level.document) visit(level.document);
  };
  visit(copy);
  return { document: copy, openedDoorIds };
}
