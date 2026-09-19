import type { EditorDocument, Point } from './schema';
import { reconcileCeilings } from './ceiling-reconciliation';
import { constrainExteriorVertex } from './exterior-vertex-constraint';
import { assertEditorDocument } from './validation';
import { invertWall, mergeWalls, splitWall } from './wall-commands';
import { upgradeConstructionDocument } from './migrations';

export type EditorCommand =
  | { type: 'invert-wall'; wallId: string }
  | { type: 'split-wall'; wallId: string; position: number; vertexId: string; newWallId: string }
  | { type: 'merge-walls'; wallId: string; otherWallId: string }
  | { type: 'move-vertex'; vertexId: string; x: number; y: number }
  | { type: 'recalibrate'; factor: number };

/** Produces a candidate; the server, not a local edit, owns revision increments. */
export function applyCommand(document: EditorDocument, command: EditorCommand): EditorDocument {
  assertEditorDocument(document);
  // A v2 opening's hinge/swing are implicit relative to its oriented wall. Resolve
  // them before an orientation-changing command so the physical opening stays put.
  // This is an explicit edit upgrade, never a side effect of reading a revision.
  const affectedWalls = command.type === 'invert-wall' ? [command.wallId]
    : command.type === 'merge-walls' ? [command.wallId, command.otherWallId] : [];
  const resolveConstruction = document.schemaVersion === 2 &&
    document.openings.some((opening) => affectedWalls.includes(opening.wallId));
  const next = resolveConstruction ? upgradeConstructionDocument(document) : structuredClone(document);
  switch (command.type) {
    case 'invert-wall':
      invertWall(next, command.wallId);
      break;
    case 'split-wall':
      splitWall(next, command.wallId, command.position, command.vertexId, command.newWallId);
      break;
    case 'merge-walls':
      mergeWalls(next, command.wallId, command.otherWallId);
      break;
    case 'move-vertex': {
      const vertex = next.vertices.find((v) => v.id === command.vertexId);
      if (!vertex) throw new Error('Vértice inexistente');
      Object.assign(vertex, constrainExteriorVertex(document, vertex.id, { x: command.x, y: command.y }));
      break;
    }
    case 'recalibrate':
      recalibrate(next, command.factor);
      break;
    default:
      throw new Error('Comando desconocido');
  }
  const reconciled = reconcileCeilings(document, next);
  assertEditorDocument(reconciled);
  return reconciled;
}

function recalibrate(doc: EditorDocument, factor: number): void {
  // Plan calibration changes XY positions and raster-derived plan dimensions only.
  // Construction heights/elevations and stair dimensions are explicit physical values.
  if (!Number.isFinite(factor) || factor <= 0 || !doc.calibration)
    throw new Error('Recalibración inválida');
  const scale = (p: Point) => {
    p.x *= factor;
    p.y *= factor;
  };
  doc.vertices.forEach(scale);
  doc.labels.forEach(scale);
  doc.luminaires?.forEach(scale);
  doc.walkthroughs?.forEach((route) => route.waypoints.forEach((point) => { scale(point); if (point.lookAt) scale(point.lookAt); }));
  doc.stairs?.forEach(scale);
  doc.boundaries?.forEach(scale);
  doc.dimensions.forEach((d) => {
    scale(d.from);
    scale(d.to);
  });
  doc.furniture.forEach((f) => {
    scale(f);
    if (f.dimensionalOrigin === 'raster') {
      f.widthMm *= factor;
      f.depthMm *= factor;
    }
  });
  doc.walls.forEach((w) => {
    if (w.dimensionalOrigin === 'raster') w.thicknessMm *= factor;
  });
  doc.openings.forEach((o) => {
    if (o.dimensionalOrigin === 'raster') o.widthMm *= factor;
  });
  doc.calibration.mmPerPixel *= factor;
}
