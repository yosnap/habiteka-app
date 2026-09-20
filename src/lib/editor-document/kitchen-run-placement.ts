import type { EditorDocument, Point } from './schema';
import { distance } from './geometry';
import { wallPath } from './wall-path';

export interface WallFaceHit { point: Point; /** Normal unitaria que sale del muro hacia el espacio libre. */ normal: Point; wallId: string }

/** Cara de muro visible más cercana a un punto, dentro de la tolerancia; el mueble de cocina se pega a ella por la trasera. */
export function snapToWallFace(doc: EditorDocument, p: Point, toleranceMm: number): WallFaceHit | null {
  let best: (WallFaceHit & { gap: number }) | null = null;
  for (const wall of doc.walls) {
    if (wall.hidden) continue;
    const path = wallPath(doc, wall), t = path.project(p), centre = path.at(t), tangent = path.tangent(t);
    const n = { x: -tangent.y, y: tangent.x }, half = wall.thicknessMm / 2;
    for (const side of [1, -1]) {
      const normal = { x: n.x * side, y: n.y * side }, point = { x: centre.x + normal.x * half, y: centre.y + normal.y * half };
      const gap = distance(p, point);
      if (gap <= toleranceMm && (!best || gap < best.gap)) best = { point, normal, wallId: wall.id, gap };
    }
  }
  return best;
}
/**
 * Ordena los extremos para que el cuerpo del mueble caiga hacia el lado libre del muro de apoyo. El cuerpo queda a
 * la izquierda del sentido de trazado, así que basta comparar esa normal con la de la cara más cercana al centro del tramo.
 */
export function orientKitchenRun(doc: EditorDocument, from: Point, to: Point, toleranceMm: number): [Point, Point] {
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, face = snapToWallFace(doc, middle, toleranceMm);
  if (!face) return [from, to];
  const length = distance(from, to), body = { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
  return body.x * face.normal.x + body.y * face.normal.y < 0 ? [to, from] : [from, to];
}
