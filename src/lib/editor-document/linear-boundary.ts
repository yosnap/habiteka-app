import type { EditorDocument, Point } from './schema';
import { OUTDOOR_CATALOG } from './outdoor-catalog';
import { upgradeBoundaryDocument } from './boundary-commands';
import { boundaryDefaults, type BoundaryKind } from './boundary-types';
export { isBoundaryKind } from './boundary-types';
import { editDocument, newId } from '@/canvas/editor-v2/editing-operations';
import { linearBoundarySupport } from './landing-wall-placement';

/** Draw along the centre line; retain one selectable entity for the whole run. */
export function addLinearBoundary(doc: EditorDocument, kind: BoundaryKind, drawnFrom: Point, drawnTo: Point, catalogId?: string | null) {
  const item = OUTDOOR_CATALOG.find((entry) => entry.kind === kind && entry.id === catalogId)
    ?? OUTDOOR_CATALOG.find((entry) => entry.kind === kind)!;
  // Sobre el borde de un descansillo se retranquea como un murete; cruzándolo o dentro, se apoya en su superficie.
  const support = linearBoundarySupport(doc, [drawnFrom, drawnTo], item.depthMm);
  const [from, to] = support.points, elevationMm = support.landingId ? support.elevationMm : item.elevationMm;
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
  if (length < 50) throw new Error('El cerramiento debe medir al menos 5 cm');
  return editDocument(upgradeBoundaryDocument(doc), (next) => {
    next.boundaries!.push(boundaryDefaults({ id: newId(), kind, catalogId: item.id,
      x: from.x + dy / length * item.depthMm / 2, y: from.y - dx / length * item.depthMm / 2,
      widthMm: length, depthMm: item.depthMm, rotation: Math.atan2(dy, dx) * 180 / Math.PI,
      heightMm: item.heightMm, elevationMm, color: item.color, dimensionalOrigin: 'physical' }));
  });
}
