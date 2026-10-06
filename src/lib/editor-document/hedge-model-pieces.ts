import type { Boundary } from './boundary-types';
import type { Furniture } from './schema';

/** Módulos de follaje sin estirar un único seto sobre todo el tramo; respeta zócalo y puertas. */
export function hedgeModelPieces(boundary: Boundary): Furniture[] {
  if (boundary.construction.infill !== 'hedge') return [];
  const { gates, baseHeightMm } = boundary.construction;
  const cuts = [...new Set([0, boundary.widthMm, ...gates.flatMap((g) =>
    [Math.max(0, g.positionMm - g.widthMm / 2), Math.min(boundary.widthMm, g.positionMm + g.widthMm / 2)])])].sort((a, b) => a - b);
  const result: Furniture[] = [], angle = boundary.rotation * Math.PI / 180;
  for (let i = 1; i < cuts.length; i++) {
    const from = cuts[i - 1]!, to = cuts[i]!, middle = (from + to) / 2;
    const bottom = Math.max(baseHeightMm, ...gates.filter((g) => Math.abs(middle - g.positionMm) < g.widthMm / 2).map((g) => g.heightMm));
    if (bottom >= boundary.heightMm || to - from < 1) continue;
    const count = Math.ceil((to - from) / 1000), widthMm = (to - from) / count;
    for (let k = 0; k < count; k++) {
      const x = from + k * widthMm;
      result.push({ id: `${boundary.id}:foliage:${i}:${k}`, kind: 'seto', catalogId: boundary.catalogId,
        x: boundary.x + x * Math.cos(angle), y: boundary.y + x * Math.sin(angle), widthMm, depthMm: boundary.depthMm,
        heightMm: boundary.heightMm - bottom, elevationMm: boundary.elevationMm + bottom,
        rotation: boundary.rotation, color: boundary.color, dimensionalOrigin: 'physical' });
    }
  }
  return result;
}
