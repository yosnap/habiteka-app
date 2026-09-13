import type { EditorDocument, Opening, Wall } from './schema';
import { EPSILON } from './geometry';
import { wallPath } from './wall-path';

export interface WallOpeningClearance { startMm: number; endMm: number }
/** Clearance of the complete host strip from neighboring wall strips, not just the axis. */
export function wallOpeningClearance(doc: EditorDocument, wall: Wall): WallOpeningClearance {
  const at = (vertexId: string) => Math.max(0, ...doc.walls.filter((other) => other.id !== wall.id &&
    (other.startVertexId === vertexId || other.endVertexId === vertexId)).map((other) => {
      const axis = wallPath(doc, wall).tangent(wall.startVertexId === vertexId ? 0 : 1);
      const direction = wallPath(doc, other).tangent(other.startVertexId === vertexId ? 0 : 1);
      const sine = Math.abs(axis.x * direction.y - axis.y * direction.x);
      if (sine < EPSILON) return 0; // Collinear continuations do not intrude sideways.
      const cosine = Math.abs(axis.x * direction.x + axis.y * direction.y);
      return (other.thicknessMm / 2 + wall.thicknessMm / 2 * cosine) / sine;
    }));
  return { startMm: at(wall.startVertexId), endMm: at(wall.endVertexId) };
}

/** Command boundary only: historical documents remain readable until deliberately repaired. */
export function assertOpeningClearance(doc: EditorDocument, opening: Opening): void {
  const wall = doc.walls.find((candidate) => candidate.id === opening.wallId);
  if (!wall) throw new Error('Abertura sin muro');
  const length = wallPath(doc, wall).length, clearance = wallOpeningClearance(doc, wall);
  const before = opening.position * length - opening.widthMm / 2;
  const after = (1 - opening.position) * length - opening.widthMm / 2;
  if (before < clearance.startMm - EPSILON || after < clearance.endMm - EPSILON)
    throw new Error('La abertura invade una esquina: deja espacio para los muros adyacentes');
}
