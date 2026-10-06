import polygonClipping, { type Pair, type Polygon } from 'polygon-clipping';
import type { EditorDocument } from './schema';
import { exteriorRoofFootprints } from './exterior-roof-footprint';
import { roofPrismGeometry } from './roof-prism-geometry';
import { exteriorRoofWallClosures, type RoofWallClosure } from './exterior-roof-wall-closures';

export interface RoofGeometry { positions: Float32Array; uvs: Float32Array; indices: Uint32Array; baseM: number; peakM: number; wallClosures: RoofWallClosure[]; glazing?: boolean; }

/** Facetas recortadas por la huella real: mantiene retranqueos y huecos de patios. */
export function exteriorRoofGeometry(doc: EditorDocument): RoofGeometry[] {
  const roof = doc.exteriorRoof;
  if (!roof) return [];
  const angle = roof.orientationDeg * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), slope = Math.tan(roof.pitchDeg * Math.PI / 180);
  return exteriorRoofFootprints(doc).map(footprint => {
    const polygon: Polygon = footprint.rings.map(ring => ring.map(p => [(p.x * c + p.y * s) / 1000, (-p.x * s + p.y * c) / 1000] as Pair));
    const outer = footprint.slopeBoundary?.map(p => [(p.x * c + p.y * s) / 1000, (-p.x * s + p.y * c) / 1000] as Pair) ?? polygon[0]!;
    const minU = Math.min(...outer.map(p => p[0])), maxU = Math.max(...outer.map(p => p[0]));
    const minV = Math.min(...outer.map(p => p[1])), maxV = Math.max(...outer.map(p => p[1])), midV = (minV + maxV) / 2;
    const w = maxU - minU, d = maxV - minV, baseM = footprint.baseMm / 1000, thickness = roof.thicknessMm / 1000;
    const top = (u: number, v: number) => baseM + thickness + (roof.kind === 'flat' ? 0
      : roof.kind === 'mono' ? v - minV : roof.kind === 'gable' ? Math.min(v - minV, maxV - v)
      : Math.min(u - minU, maxU - u, v - minV, maxV - v)) * slope;
    let cells: Pair[][] = [outer];
    if (roof.kind === 'gable') cells = [
      [[minU, minV], [maxU, minV], [maxU, midV], [minU, midV]],
      [[minU, midV], [maxU, midV], [maxU, maxV], [minU, maxV]],
    ];
    if (roof.kind === 'hip') {
      if (w >= d) {
        const a = minU + d / 2, b = maxU - d / 2;
        cells = [[[minU, minV], [maxU, minV], [b, midV], [a, midV]],
          [[minU, maxV], [a, midV], [b, midV], [maxU, maxV]],
          [[minU, minV], [a, midV], [minU, maxV]], [[maxU, minV], [maxU, maxV], [b, midV]]];
      } else {
        const midU = (minU + maxU) / 2, a = minV + w / 2, b = maxV - w / 2;
        cells = [[[minU, minV], [midU, a], [midU, b], [minU, maxV]],
          [[maxU, minV], [maxU, maxV], [midU, b], [midU, a]],
          [[minU, minV], [maxU, minV], [midU, a]], [[minU, maxV], [midU, b], [maxU, maxV]]];
      }
    }
    const parts = roof.kind === 'flat' || roof.kind === 'mono' ? [polygon]
      : cells.flatMap(cell => polygonClipping.intersection(polygon, [cell]));
    const world = (u: number, v: number): Pair => [u * c - v * s, u * s + v * c];
    const underside = (u: number, v: number) => top(u, v) - thickness;
    const geometry = roofPrismGeometry(parts, world, top, footprint.glazing ? (u, v) => top(u, v) - .02 : underside);
    if (!geometry.positions.length) throw new Error('No se pudo construir la geometría del tejado. Revisa su huella.');
    return { ...geometry, baseM, ...(footprint.glazing ? { glazing: true } : {}), peakM: Math.max(...[...geometry.positions].filter((_, index) => index % 3 === 1)),
      wallClosures: footprint.glazing ? [] : exteriorRoofWallClosures(doc, parts, (x, y) => [(x * c + y * s) / 1000, (-x * s + y * c) / 1000], world, underside) };
  });
}
