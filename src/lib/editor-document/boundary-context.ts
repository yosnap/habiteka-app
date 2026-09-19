import type { EditorDocument } from './schema';
import { boundaryDefaults, isBoundary, isLegacyBoundary, planObjects } from './boundary-types';
import { localToWorld } from './spatial-properties';
const meters = (n: number) => Number((n / 1000).toFixed(3));
export const BOUNDARY_RENDER_POLICY = 'Los cerramientos son construcción permanente: conserva muro inferior, altura superior, orientación de lamas, separación, sección circular o rectangular de postes, colores y cada puerta con su hueco y apertura. No rellenes puertas ni sustituyas postes circulares por cuadrados.';
export function boundaryDesignContext(doc: EditorDocument) {
  return planObjects(doc).filter((b) => isBoundary(b) || isLegacyBoundary(b)).map((item) => {
    const b = isBoundary(item) ? item : boundaryDefaults(item), c = b.construction;
    return { id: b.id, name: b.name ?? 'Cerramiento', kind: b.kind,
      endpointsM: [0, b.widthMm].map((x) => { const p = localToWorld(b, { x, y: b.depthMm / 2 }); return { x: meters(p.x), y: meters(p.y) }; }),
      lengthM: meters(b.widthMm), thicknessM: meters(b.depthMm), elevationM: meters(b.elevationMm), heightM: meters(b.heightMm),
      baseHeightM: meters(c.baseHeightMm), baseColor: c.baseColor, baseMaterial: c.baseMaterialId ?? null, infillMaterial: c.infillMaterialId ?? null, postMaterial: c.postMaterialId ?? null, upperHeightM: meters(b.heightMm - c.baseHeightMm),
      infill: c.infill, infillColor: b.color, slatWidthM: meters(c.slatWidthMm), gapM: meters(c.gapMm),
      postShape: c.postShape, postSizeM: meters(c.postSizeMm), postSpacingM: meters(c.postSpacingMm), postColor: c.postColor,
      gates: c.gates.map((g) => ({ id: g.id, positionM: meters(g.positionMm), widthM: meters(g.widthMm), heightM: meters(g.heightMm), hinge: g.hinge, openAngleDeg: g.openAngleDeg, color: g.color })),
    };
  });
}
