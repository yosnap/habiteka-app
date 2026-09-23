import type { EditorDocument, Opening, Wall } from './schema';
import { EPSILON } from './geometry';
import { wallPath } from './wall-path';
import { parseEditorDocument } from './validation';
import { upgradeConstructionDocument } from './migrations';
import { wallConstruction } from './construction-properties';

const CONTINUATION_SINE = Math.sin(15 * Math.PI / 180);
export interface WallOpeningClearance { startMm: number; endMm: number }
/** Clearance of the complete host strip from neighboring wall strips, not just the axis. */
export function wallOpeningClearance(doc: EditorDocument, wall: Wall): WallOpeningClearance {
  // Los tramos ocultos (bordes de patio) no tienen cuerpo: no estorban a una abertura en la esquina.
  const at = (vertexId: string) => Math.max(0, ...doc.walls.filter((other) => other.id !== wall.id && !other.hidden &&
    (other.startVertexId === vertexId || other.endVertexId === vertexId)).map((other) => {
      const axis = wallPath(doc, wall).tangent(wall.startVertexId === vertexId ? 0 : 1);
      const direction = wallPath(doc, other).tangent(other.startVertexId === vertexId ? 0 : 1);
      const sine = Math.abs(axis.x * direction.y - axis.y * direction.x);
      // Una continuación casi recta (menos de 15°) no invade de lado: la fórmula divide por el seno y se dispararía.
      if (sine < CONTINUATION_SINE) return 0;
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

/** Milímetros que la abertura invade la esquina; 0 cuando respeta la holgura. */
export function openingClearanceDeficitMm(doc: EditorDocument, opening: Opening): number {
  const wall = doc.walls.find((candidate) => candidate.id === opening.wallId);
  if (!wall) return Infinity;
  const length = wallPath(doc, wall).length, clearance = wallOpeningClearance(doc, wall);
  const before = opening.position * length - opening.widthMm / 2;
  const after = (1 - opening.position) * length - opening.widthMm / 2;
  return Math.max(0, clearance.startMm - before, clearance.endMm - after);
}

/** Una edición no puede crear ni agravar una invasión; una abertura heredada demasiado cerca de la esquina sigue tolerada. */
export function assertOpeningClearanceNotWorse(previous: EditorDocument, candidate: EditorDocument, opening: Opening): void {
  const earlier = previous.openings.find((item) => item.id === opening.id);
  const tolerated = earlier ? openingClearanceDeficitMm(previous, earlier) : 0;
  if (openingClearanceDeficitMm(candidate, opening) > tolerated + EPSILON)
    throw new Error('La abertura invade una esquina: deja espacio para los muros adyacentes');
}

/**
 * El hueco más ancho que admite el muro: de esquina a esquina, dejando solo el
 * cuerpo de los muros que llegan a ellas. Es «ocupar todo el muro» sin romper
 * la regla de esquinas; para quitar el muro entero se oculta el muro.
 */
export function fullWallOpeningSpan(doc: EditorDocument, opening: Opening): { position: number; widthMm: number } {
  const wall = doc.walls.find((candidate) => candidate.id === opening.wallId);
  if (!wall) throw new Error('Abertura sin muro');
  const length = wallPath(doc, wall).length, clearance = wallOpeningClearance(doc, wall);
  const widthMm = length - clearance.startMm - clearance.endMm;
  if (widthMm < 50) throw new Error('El muro es demasiado corto para abrir un hueco entre sus esquinas');
  return { position: (clearance.startMm + widthMm / 2) / length, widthMm };
}

/** Comando: estira la abertura al máximo del muro (ver `fullWallOpeningSpan`); un hueco, también en altura. */
export function fillWallWithOpening(source: EditorDocument, openingId: string): EditorDocument {
  // Altura y cota de un hueco solo existen en documentos con construcción.
  const doc = upgradeConstructionDocument(source);
  const opening = doc.openings.find((item) => item.id === openingId);
  if (!opening) throw new Error('Abertura no encontrada');
  Object.assign(opening, fullWallOpeningSpan(doc, opening));
  // Un hueco (paso sin puerta ni carpintería) ocupa también toda la altura: sin dintel.
  // Puertas y ventanas conservan su altura, que es la de su carpintería.
  if (opening.kind === 'hueco') {
    const wall = doc.walls.find((item) => item.id === opening.wallId)!;
    opening.elevationMm = wall.baseElevationMm ?? 0;
    opening.heightMm = wallConstruction(wall).heightMm;
  }
  assertOpeningClearance(doc, opening);
  return parseEditorDocument(doc);
}
