import type { EditorDocument, Furniture } from './schema';
export type BoundaryKind = 'valla-madera' | 'cerca-metal' | 'seto';
export interface BoundaryGate {
  id: string;
  positionMm: number;
  widthMm: number;
  heightMm: number;
  hinge: 'left' | 'right';
  openAngleDeg: number;
  color: string;
}
export interface BoundaryConstruction {
  baseHeightMm: number;
  baseColor: string;
  baseMaterialId?: string;
  infillMaterialId?: string;
  postMaterialId?: string;
  infill: 'vertical' | 'horizontal' | 'hedge';
  slatWidthMm: number;
  gapMm: number;
  postShape: 'rectangle' | 'circle';
  postSizeMm: number;
  postSpacingMm: number;
  postColor: string;
  gates: BoundaryGate[];
}
/** Construction entity with a footprint compatible with the editor's spatial controls. */
export interface Boundary extends Furniture {
  kind: BoundaryKind;
  heightMm: number;
  elevationMm: number;
  color: string;
  construction: BoundaryConstruction;
}
export function isBoundary(item: Furniture): item is Boundary { return 'construction' in item; }
export function isBoundaryKind(kind: string): kind is BoundaryKind { return ['valla-madera', 'cerca-metal', 'seto'].includes(kind); }
export function isLegacyBoundary(item: Furniture) { return isBoundaryKind(item.kind) && item.catalogId === `habiteka:outdoor:${item.kind}`; }
export function planObjects(doc: EditorDocument): (Furniture | Boundary)[] { return [...doc.furniture, ...(doc.boundaries ?? [])]; }
export function boundaryDefaults(item: Furniture): Boundary {
  return { ...item, kind: item.kind as BoundaryKind, heightMm: item.heightMm ?? 1400, elevationMm: item.elevationMm ?? 0,
    color: item.color ?? '#535d59', construction: {
      baseHeightMm: 0, baseColor: '#dedbd3', infill: item.kind === 'seto' ? 'hedge' : 'vertical',
      slatWidthMm: 70, gapMm: 100, postShape: 'rectangle', postSizeMm: Math.min(120, item.depthMm),
      postSpacingMm: 2000, postColor: item.color ?? '#535d59', gates: [],
    } };
}
export function boundaryGateOwner(doc: EditorDocument, id: string | undefined) {
  for (const boundary of doc.boundaries ?? []) {
    const gate = boundary.construction.gates.find((g) => g.id === id);
    if (gate) return { boundary, gate };
  }
  return undefined;
}
