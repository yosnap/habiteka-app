import { createHash } from 'node:crypto';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import type { EditorDocument } from '@/lib/editor-document/schema';

/** Solo estructura espacial: mover un mueble o cambiar una luz no corrige un plano. */
export function editorGeometryFingerprint(document: EditorDocument): string {
  const geometry = buildingDocuments(document).map((level) => ({
    id: level.id,
    vertices: [...level.document.vertices].sort(byId).map(({ id, x, y }) => [id, x, y]),
    walls: [...level.document.walls].sort(byId).map(({ id, startVertexId, endVertexId, thicknessMm, hidden }) =>
      [id, startVertexId, endVertexId, thicknessMm, hidden === true]),
    openings: [...level.document.openings].sort(byId).map(({ id, wallId, position, widthMm }) =>
      [id, wallId, position, widthMm]),
  }));
  return createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id.localeCompare(b.id);
}
