import type { Pair } from 'polygon-clipping';
import type { ExteriorRoof } from './exterior-roof';
import type { Point, EditorDocument } from './schema';
import { exteriorRoofBaseFootprints } from './exterior-roof-footprint';
import { roofPolygonIntersection } from './roof-polygon-intersection';

/** Las mismas facetas para construir el volumen y enseñar sus aristas al colocar ventanas. */
export function roofSlopeCells(outer: Pair[], kind: ExteriorRoof['kind']): Pair[][] {
  const minU = Math.min(...outer.map(p => p[0])), maxU = Math.max(...outer.map(p => p[0]));
  const minV = Math.min(...outer.map(p => p[1])), maxV = Math.max(...outer.map(p => p[1]));
  const w = maxU - minU, d = maxV - minV, midU = (minU + maxU) / 2, midV = (minV + maxV) / 2;
  if (kind === 'gable') return [
    [[minU, minV], [maxU, minV], [maxU, midV], [minU, midV]],
    [[minU, midV], [maxU, midV], [maxU, maxV], [minU, maxV]],
  ];
  if (kind !== 'hip') return [outer];
  if (w >= d) {
    const a = minU + d / 2, b = maxU - d / 2;
    return [[[minU, minV], [maxU, minV], [b, midV], [a, midV]],
      [[minU, maxV], [a, midV], [b, midV], [maxU, maxV]],
      [[minU, minV], [a, midV], [minU, maxV]], [[maxU, minV], [maxU, maxV], [b, midV]]];
  }
  const a = minV + w / 2, b = maxV - w / 2;
  return [[[minU, minV], [midU, a], [midU, b], [minU, maxV]],
    [[maxU, minV], [maxU, maxV], [midU, b], [midU, a]],
    [[minU, minV], [maxU, minV], [midU, a]], [[minU, maxV], [midU, b], [maxU, maxV]]];
}

export function roofPlanFacets(doc: EditorDocument): Point[][] {
  if (!doc.exteriorRoof) return [];
  const roof = doc.exteriorRoof, angle = roof.orientationDeg * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return exteriorRoofBaseFootprints(doc).filter(part => !part.glazing).flatMap(part => {
    const outer = part.rings[0]!.map(p => [p.x * c + p.y * s, -p.x * s + p.y * c] as Pair);
    return roofSlopeCells(outer, roof.kind).flatMap(cell => roofPolygonIntersection([outer], [cell]))
      .map(shape => shape[0]!.map(([u, v]) => ({ x: u * c - v * s, y: u * s + v * c })));
  });
}
