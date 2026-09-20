import type { EditorDocument, Ramp, Wall } from './schema';
import { distance, wallPoints } from './geometry';
import { localToWorld } from './spatial-properties';

/**
 * Un descansillo puede abrazar la esquina de un muro, es decir, solaparse con su extremo (hasta dos grosores desde el
 * vértice hacia dentro) como hace con una columna, pero nunca invadir el tramo intermedio del muro.
 */
export function landingHugsWallEnd(doc: EditorDocument, landing: Ramp, wall: Wall): boolean {
  if (wall.curveHeightMm) return false;
  const [a, b] = wallPoints(doc, wall), length = distance(a, b);
  if (length <= 0) return false;
  const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  const along = [{ x: 0, y: 0 }, { x: landing.widthMm, y: 0 }, { x: landing.widthMm, y: landing.depthMm }, { x: 0, y: landing.depthMm }]
    .map((p) => localToWorld(landing, p)).map((p) => (p.x - a.x) * u.x + (p.y - a.y) * u.y);
  const zone = 2 * wall.thicknessMm;
  return Math.max(...along) <= zone || Math.min(...along) >= length - zone;
}
