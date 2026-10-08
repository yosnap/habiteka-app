import type { Pair, Polygon } from 'polygon-clipping';
import type { EditorDocument } from './schema';
import { exteriorRoofFootprints } from './exterior-roof-footprint';
import { roofPrismGeometry } from './roof-prism-geometry';
import { exteriorRoofWallClosures, type RoofWallClosure } from './exterior-roof-wall-closures';
import { roofPolygonIntersection } from './roof-polygon-intersection';
import { roofSlopeCells } from './roof-slope-cells';
import { chimneyFaceUvs } from './roof-chimney-geometry';

export interface RoofGeometry { positions: Float32Array; uvs: Float32Array; indices: Uint32Array; baseM: number; peakM: number; wallClosures: RoofWallClosure[]; glazing?: boolean; frame?: boolean; chimney?: boolean; openingId?: string; }

/** Facetas recortadas por la huella real: mantiene retranqueos y huecos de patios. */
export function exteriorRoofGeometry(doc: EditorDocument): RoofGeometry[] {
  const roof = doc.exteriorRoof;
  if (!roof) return [];
  const angle = roof.orientationDeg * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), slope = Math.tan(roof.pitchDeg * Math.PI / 180);
  return exteriorRoofFootprints(doc).map(footprint => {
    const polygon: Polygon = footprint.rings.map(ring => ring.map(p => [(p.x * c + p.y * s) / 1000, (-p.x * s + p.y * c) / 1000] as Pair));
    const outer = footprint.slopeBoundary?.map(p => [(p.x * c + p.y * s) / 1000, (-p.x * s + p.y * c) / 1000] as Pair) ?? polygon[0]!;
    const minU = Math.min(...outer.map(p => p[0])), maxU = Math.max(...outer.map(p => p[0]));
    const minV = Math.min(...outer.map(p => p[1])), maxV = Math.max(...outer.map(p => p[1]));
    const baseM = footprint.baseMm / 1000, thickness = roof.thicknessMm / 1000;
    const top = (u: number, v: number) => baseM + thickness + (roof.kind === 'flat' ? 0
      : roof.kind === 'mono' ? v - minV : roof.kind === 'gable' ? Math.min(v - minV, maxV - v)
      : Math.min(u - minU, maxU - u, v - minV, maxV - v)) * slope;
    const cells = roofSlopeCells(outer, roof.kind);
    const parts = roof.kind === 'flat' || roof.kind === 'mono' ? [polygon]
      : cells.flatMap(cell => roofPolygonIntersection(polygon, [cell]));
    if (footprint.openingId && roof.openings?.find(item => item.id === footprint.openingId)?.kind === 'roof-window' && parts.length > 1)
      throw new Error('La ventana de techo debe quedar en una sola pendiente, sin cruzar la cumbrera ni las aristas.');
    const world = (u: number, v: number): Pair => [u * c - v * s, u * s + v * c];
    const underside = (u: number, v: number) => top(u, v) - thickness;
    const chimneyTop = Math.max(...parts.flatMap(part => part[0]!.map(([u, v]) => top(u, v))))
      + (roof.openings?.find(item => item.id === footprint.openingId)?.heightMm ?? 1200) / 1000;
    const chimneyBottom = Math.min(...parts.flatMap(part => part[0]!.map(([u, v]) => underside(u, v))));
    const prism = roofPrismGeometry(footprint.chimney ? [polygon] : parts, world, footprint.chimney ? () => chimneyTop : top,
      footprint.chimney ? () => chimneyBottom : footprint.glazing ? (u, v) => top(u, v) - .02 : footprint.frame ? (u, v) => top(u, v) - .06 : underside);
    const geometry = footprint.chimney ? chimneyFaceUvs(prism) : prism;
    if (!geometry.positions.length) throw new Error('No se pudo construir la geometría del tejado. Revisa su huella.');
    return { ...geometry, baseM, ...(footprint.glazing ? { glazing: true } : {}), ...(footprint.frame ? { frame: true } : {}), ...(footprint.chimney ? { chimney: true } : {}),
      ...(footprint.openingId ? { openingId: footprint.openingId } : {}), peakM: Math.max(...[...geometry.positions].filter((_, index) => index % 3 === 1)),
      wallClosures: footprint.glazing || footprint.frame || footprint.chimney ? [] : exteriorRoofWallClosures(doc, parts, (x, y) => [(x * c + y * s) / 1000, (-x * s + y * c) / 1000], world, underside) };
  });
}
