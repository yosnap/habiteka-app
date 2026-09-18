import type { EditorDocument, Point } from './schema';
import { OUTDOOR_CATALOG } from './outdoor-catalog';
import { upgradeSpatialDocument } from './spatial-properties';
import { editDocument, newId } from '@/canvas/editor-v2/editing-operations';

export type BoundaryKind = 'valla-madera' | 'cerca-metal' | 'seto';
export function isBoundaryKind(kind: string): kind is BoundaryKind {
  return ['valla-madera', 'cerca-metal', 'seto'].includes(kind);
}
/** Draw along the centre line; retain one selectable entity for the whole run. */
export function addLinearBoundary(doc: EditorDocument, kind: BoundaryKind, from: Point, to: Point) {
  const item = OUTDOOR_CATALOG.find((entry) => entry.kind === kind)!;
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
  if (length < 50) throw new Error('El cerramiento debe medir al menos 5 cm');
  return editDocument(upgradeSpatialDocument(doc), (next) => {
    next.furniture.push({ id: newId(), kind, catalogId: item.id,
      x: from.x + dy / length * item.depthMm / 2, y: from.y - dx / length * item.depthMm / 2,
      widthMm: length, depthMm: item.depthMm, rotation: Math.atan2(dy, dx) * 180 / Math.PI,
      heightMm: item.heightMm, elevationMm: item.elevationMm, color: item.color, dimensionalOrigin: 'physical' });
  });
}
