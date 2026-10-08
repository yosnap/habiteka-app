import type { EditorDocument, Point } from './schema';
import { wallPath } from './wall-path';
import { distance } from './geometry';

/** Solo une suelos existentes en las dos caras del hueco. No convierte terreno decorativo en suelo. */
export function walkthroughThresholds(doc: EditorDocument, supportAt: (p: Point) => number | null, clearance: number) {
  const thresholds = doc.walls.filter(wall => !wall.hidden).flatMap(wall => {
    const path = wallPath(doc, wall);
    return doc.openings.filter(opening => opening.wallId === wall.id && opening.kind !== 'ventana' &&
      (opening.kind !== 'puerta' || (opening.openAngleDeg ?? 90) >= 75)).map(opening => ({ wall, path, opening }));
  });
  return (p: Point) => {
    for (const { wall, path, opening } of thresholds) {
      const t = path.project(p), center = path.at(t);
      if (Math.abs(t - opening.position) * path.length > opening.widthMm / 2 - clearance ||
        distance(p, center) > wall.thicknessMm / 2 + clearance + 1) continue;
      const tangent = path.tangent(t), offset = wall.thicknessMm / 2 + 1;
      const a = supportAt({ x: center.x - tangent.y * offset, y: center.y + tangent.x * offset });
      const b = supportAt({ x: center.x + tangent.y * offset, y: center.y - tangent.x * offset });
      if (a === null || b === null || Math.abs(a - b) > 220) continue;
      const sill = opening.elevationMm ?? 0, top = Math.max(a, b, sill);
      const rise = top - Math.min(a, b);
      if (rise > 220 || sill + (opening.heightMm ?? 2100) < top + 1700) continue;
      return { id: opening.id, floorMm: top, riseMm: rise };
    }
    return null;
  };
}
