import type { EditorDocument } from './schema';
import { upgradeSpatialDocument } from './spatial-properties';
import { parseEditorDocument } from './validation';
import { wallFaces } from './wall-faces';
import { wallPath } from './wall-path';
import { wallPoints } from './geometry';

/** Outside a bounded room; stable world orientation when no unique exterior exists. */
export function defaultWallCurve(input: EditorDocument, wallId: string): number {
  const wall = input.walls.find((w) => w.id === wallId);
  if (!wall) throw new Error('Pared inexistente');
  const exterior = wallFaces(input, wall).find((face) => face.label === 'Exterior');
  const [a, b] = wallPoints(input, wall);
  const sign = exterior ? (exterior.side === 'left' ? 1 : -1) : (a.x < b.x || (a.x === b.x && a.y < b.y) ? -1 : 1);
  return sign * wallPath(input, wall).chord / 5;
}

export function setWallCurve(input: EditorDocument, wallId: string, heightMm: number): EditorDocument {
  const doc = upgradeSpatialDocument(input), wall = doc.walls.find((w) => w.id === wallId);
  if (!wall) throw new Error('Pared inexistente');
  if (doc.schemaVersion < 5) doc.schemaVersion = 5; doc.floorFinishes ??= [];
  if (!Number.isFinite(heightMm)) throw new Error('Curvatura inválida');
  if (Math.abs(heightMm) < .001) delete wall.curveHeightMm; else wall.curveHeightMm = heightMm;
  doc.revision += 1;
  return parseEditorDocument(doc);
}
