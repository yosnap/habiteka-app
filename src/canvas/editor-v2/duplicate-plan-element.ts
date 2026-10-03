import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { editDocument } from './editing-operations';
import { duplicateSpatialItem, findSpatialItem, insertSpatialItem } from './spatial-clipboard';

/** La copia conserva el original y nunca reutiliza sus vértices o identificadores. */
export function duplicatePlanElement(doc: EditorDocument, id: string, delta: Point) {
  const copyId = crypto.randomUUID();
  const wall = doc.walls.find(item => item.id === id);
  if (wall) {
    const document = editDocument(doc, next => {
      const start = doc.vertices.find(vertex => vertex.id === wall.startVertexId)!;
      const end = doc.vertices.find(vertex => vertex.id === wall.endVertexId)!;
      const startVertexId = crypto.randomUUID(), endVertexId = crypto.randomUUID();
      next.vertices.push({ ...start, id: startVertexId, x: start.x + delta.x, y: start.y + delta.y },
        { ...end, id: endVertexId, x: end.x + delta.x, y: end.y + delta.y });
      next.walls.push({ ...structuredClone(wall), id: copyId, startVertexId, endVertexId });
      next.openings.push(...doc.openings.filter(opening => opening.wallId === id).map(opening =>
        ({ ...structuredClone(opening), id: crypto.randomUUID(), wallId: copyId })));
    });
    return { document, id: copyId };
  }
  const terrain = doc.terrainSurfaces?.find(item => item.id === id);
  if (terrain) return { id: copyId, document: editDocument(doc, next => {
    next.terrainSurfaces!.push({ ...structuredClone(terrain), id: copyId, x: terrain.x + delta.x, y: terrain.y + delta.y });
  }) };
  const item = findSpatialItem(doc, id);
  if (!item) throw new Error('Este elemento no admite duplicación por arrastre.');
  const copy = { ...duplicateSpatialItem(item), x: item.x + delta.x, y: item.y + delta.y };
  return { document: insertSpatialItem(doc, copy), id: copy.id };
}
