import type { EditorDocument, Point, Wall } from '@/lib/editor-document/schema';
import { distance } from '@/lib/editor-document/geometry';
import { wallConstruction } from '@/lib/editor-document/construction-properties';
import { materialColor } from './types';
import { wallPath } from '@/lib/editor-document/wall-path';

/** Continue each wall's oriented face along the corresponding miter edge. */
export function junctionFinishes(doc: EditorDocument, walls: Wall[], points: Point[]) {
  return points.map((a, index) => {
    const b = points[(index + 1) % points.length]!, length = distance(a, b);
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const matches = walls.map((wall) => {
      const path = wallPath(doc, wall), t = path.project(midpoint), start = path.at(t), direction = path.tangent(t);
      const dx = direction.x, dy = direction.y;
      const signedDistance = (midpoint.x - start.x) * -dy + (midpoint.y - start.y) * dx;
      const side = signedDistance >= 0 ? 'left' : 'right';
      const alignment = Math.abs(((b.x - a.x) * dx + (b.y - a.y) * dy) / length);
      return { sourceEntityId: wall.id, color: wall.colors?.[side] ?? materialColor(wallConstruction(wall).materials[side]),
        materialId: wallConstruction(wall).materials[side],
        offsetX: path.length * t / 1000 - length / 2000,
        // Parallel face first; distance disambiguates collinear unequal-width joins.
        score: (1 - alignment) * 1e6 + Math.abs(Math.abs(signedDistance) - wall.thicknessMm / 2) };
    });
    const match = matches.sort((x, y) => x.score - y.score || x.sourceEntityId.localeCompare(y.sourceEntityId))[0]!;
    return { color: match.color, sourceEntityId: match.sourceEntityId, materialId: match.materialId, offsetX: match.offsetX };
  });
}
