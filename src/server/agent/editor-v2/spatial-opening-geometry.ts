import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { wallPath } from '@/lib/editor-document/wall-path';
import { openingMeshes } from '@/canvas/editor-v2/scene/opening-meshes';

export interface SpatialOpening {
  id: string;
  kind: 'puerta' | 'ventana' | 'hueco';
  center: Point;
  widthMm: number;
  heightMm: number;
  leafWidthMm?: number;
  openAngleDeg?: number;
  hinge?: string;
  swing?: string;
  /** Barrido desde cerrada hasta el ángulo configurado; no es una nueva cota normativa. */
  swingClearance?: { hinge: Point; closedEnd: Point; openEnd: Point; polygon: Point[] };
}

export const roundedPoint = ({ x, y }: Point): Point => ({ x: Math.round(x), y: Math.round(y) });

/** Usa las mismas hojas rígidas del 3D, también en muros curvos. */
export function spatialOpenings(doc: EditorDocument, prefix: string): SpatialOpening[] {
  const walls = new Map(doc.walls.filter(wall => !wall.hidden).map(wall => [wall.id, wall]));
  return doc.openings.filter(opening => walls.has(opening.wallId)).map((opening, index) => {
    const props = openingConstruction(opening), center = wallPath(doc, walls.get(opening.wallId)!).at(opening.position);
    const base = { id: `${prefix}-O${index + 1}`, kind: opening.kind, center: roundedPoint(center),
      widthMm: Math.round(opening.widthMm), heightMm: Math.round(props.heightMm) };
    if (opening.kind !== 'puerta') return base;
    const leaf = openingMeshes(doc, opening).find(box => box.role === 'leaf');
    if (!leaf) return base;
    const radius = leaf.size[0] * 1000, angle = -leaf.rotation;
    const hinge = { x: leaf.position[0] * 1000 - Math.cos(angle) * radius / 2,
      y: leaf.position[2] * 1000 - Math.sin(angle) * radius / 2 };
    const delta = (props.hinge === 'left' ? 1 : -1) * (props.swing === 'left' ? 1 : -1) * props.openAngleDeg * Math.PI / 180;
    const end = (a: number) => roundedPoint({ x: hinge.x + Math.cos(a) * radius, y: hinge.y + Math.sin(a) * radius });
    const steps = Math.max(1, Math.ceil(Math.abs(props.openAngleDeg) / 15));
    return { ...base, leafWidthMm: Math.round(radius), openAngleDeg: props.openAngleDeg, hinge: props.hinge, swing: props.swing,
      swingClearance: { hinge: roundedPoint(hinge), closedEnd: end(angle - delta), openEnd: end(angle),
        polygon: [roundedPoint(hinge), ...Array.from({ length: steps + 1 }, (_, i) => end(angle - delta + delta * i / steps))] } };
  });
}
