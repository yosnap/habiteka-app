import type { Pair, Polygon } from 'polygon-clipping';
import type { EditorDocument } from './schema';
import { eligibleCeilingRooms } from './ceiling-geometry';
import { wallConstruction } from './construction-properties';
import { wallPath, wallStrip } from './wall-path';
import { roofPrismGeometry, type RoofPrismGeometry } from './roof-prism-geometry';
import { roofPolygonIntersection } from './roof-polygon-intersection';
export interface RoofWallClosure extends RoofPrismGeometry { wallId: string; buildBaseM: number; }

/** Prolonga los muros existentes hasta el intradós; conserva sus huecos y su cota base. */
export function exteriorRoofWallClosures(doc: EditorDocument, facets: Polygon[],
  project: (xMm: number, yMm: number) => Pair, world: (u: number, v: number) => Pair,
  underside: (u: number, v: number) => number): RoofWallClosure[] {
  const selected = new Set(doc.exteriorRoof!.roomIds);
  const ids = new Set(eligibleCeilingRooms(doc).filter(room => selected.has(room.id)).flatMap(room => room.wallIds));
  return doc.walls.filter(wall => ids.has(wall.id) && !wall.hidden).flatMap(wall => {
    const path = wallPath(doc, wall), strip = wallStrip(doc, wall), n = strip.length / 2;
    // Los remates se solapan en las esquinas, como las juntas del muro original.
    for (const [indices, t, sign] of [[[0, strip.length - 1], 0, -1], [[n - 1, n], 1, 1]] as const) {
      const tangent = path.tangent(t);
      for (const index of indices) { strip[index]!.x += tangent.x * wall.thicknessMm / 2 * sign; strip[index]!.y += tangent.y * wall.thicknessMm / 2 * sign; }
    }
    const footprint: Polygon = [strip.map(p => project(p.x, p.y))];
    const parts = facets.flatMap(facet => roofPolygonIntersection(footprint, facet));
    const bottomM = ((wall.baseElevationMm ?? 0) + wallConstruction(wall).heightMm) / 1000;
    if (!parts.some(part => part.flat().some(([u, v]) => underside(u, v) > bottomM + .0001))) return [];
    const geometry = roofPrismGeometry(parts, world, underside, () => bottomM);
    // UV en metros sobre el mismo recorrido del muro, manteniendo el acabado vertical.
    for (let i = 0; i < geometry.positions.length; i += 3) {
      const point = { x: geometry.positions[i]! * 1000, y: geometry.positions[i + 2]! * 1000 };
      geometry.uvs[i / 3 * 2] = path.project(point) * path.length / 1000;
      geometry.uvs[i / 3 * 2 + 1] = geometry.positions[i + 1]!;
    }
    return [{ ...geometry, wallId: wall.id, buildBaseM: (wall.baseElevationMm ?? 0) / 1000 }];
  });
}
