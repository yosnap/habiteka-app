import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { wallPath } from '@/lib/editor-document/wall-path';
import { isBasicOpeningType, openingType } from '@/lib/editor-document/opening-types';
import { worldOpeningLeaves, type WorldLeaf } from '@/lib/editor-document/opening-leaves';

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
  /** Tipo de puerta o ventana cuando no es el básico (p. ej. «Puerta corredera vista»). */
  type?: string;
  /** Barrido desde cerrada hasta el ángulo configurado; no es una nueva cota normativa. */
  swingClearance?: SwingClearance;
  /** Barrido de la segunda hoja de una puerta de dos hojas. */
  secondSwingClearance?: SwingClearance;
  /** Franja junto al muro por la que se desliza o pliega la hoja (corredera vista, plegable): sin arco de giro. */
  slideClearance?: { polygon: Point[] };
}
export interface SwingClearance { hinge: Point; closedEnd: Point; openEnd: Point; polygon: Point[] }

export const roundedPoint = ({ x, y }: Point): Point => ({ x: Math.round(x), y: Math.round(y) });

/** Usa las mismas hojas rígidas del 3D, también en muros curvos. */
export function spatialOpenings(doc: EditorDocument, prefix: string): SpatialOpening[] {
  const walls = new Map(doc.walls.filter(wall => !wall.hidden).map(wall => [wall.id, wall]));
  return doc.openings.filter(opening => walls.has(opening.wallId)).map((opening, index) => {
    const props = openingConstruction(opening), center = wallPath(doc, walls.get(opening.wallId)!).at(opening.position);
    const base = { id: `${prefix}-O${index + 1}`, kind: opening.kind, center: roundedPoint(center),
      widthMm: Math.round(opening.widthMm), heightMm: Math.round(props.heightMm) };
    const type = openingType(opening);
    const typed = type && !isBasicOpeningType(type) ? { ...base, type: type.name } : base;
    if (opening.kind !== 'puerta') return typed;
    const layout = worldOpeningLeaves(doc, opening);
    // La de vaivén barre también hacia la otra cara: ese giro es su segundo abanico.
    const swings = (layout?.leaves ?? []).flatMap((leaf) => leaf.hinge ? [swingClearance(leaf, props.openAngleDeg),
      ...(leaf.hinge.doubleActing ? [swingClearance(leaf, props.openAngleDeg, -1)] : [])] : []);
    if (!layout?.leaves.length) return typed;
    return { ...typed, leafWidthMm: Math.round(layout.leaves[0]!.lengthMm), openAngleDeg: props.openAngleDeg, hinge: props.hinge, swing: props.swing,
      ...(swings[0] ? { swingClearance: swings[0] } : {}), ...(swings[1] ? { secondSwingClearance: swings[1] } : {}),
      ...(layout.travel[0] ? { slideClearance: { polygon: layout.travel[0].map(roundedPoint) } } : {}) };
  });
}

/** Abanico de una hoja abatible, de cerrada a abierta, cada 15°; en una pivotante, el del tramo más largo de la hoja. */
function swingClearance(leaf: WorldLeaf, openAngleDeg: number, direction: 1 | -1 = 1): SwingClearance {
  const { pivot, closedAngle } = leaf.hinge!, delta = direction * leaf.hinge!.delta, radius = leaf.lengthMm - (leaf.hinge!.offsetMm ?? 0);
  const end = (a: number) => roundedPoint({ x: pivot.x + Math.cos(a) * radius, y: pivot.y + Math.sin(a) * radius });
  const steps = Math.max(1, Math.ceil(Math.abs(openAngleDeg) / 15));
  return { hinge: roundedPoint(pivot), closedEnd: end(closedAngle), openEnd: end(closedAngle + delta),
    polygon: [roundedPoint(pivot), ...Array.from({ length: steps + 1 }, (_, i) => end(closedAngle + delta * i / steps))] };
}
