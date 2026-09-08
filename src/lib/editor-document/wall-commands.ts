import type { EditorDocument, Opening } from './schema';
import { cross, distance, EPSILON, interpolate, wallPoints } from './geometry';
import { wallPath } from './wall-path';

export function requireWall(doc: EditorDocument, id: string) {
  const wall = doc.walls.find((w) => w.id === id);
  if (!wall) throw new Error('Muro inexistente');
  return wall;
}

export function invertWall(doc: EditorDocument, id: string): void {
  const wall = requireWall(doc, id);
  [wall.startVertexId, wall.endVertexId] = [wall.endVertexId, wall.startVertexId];
  if (wall.curveHeightMm) wall.curveHeightMm *= -1;
  if (wall.materials) [wall.materials.left, wall.materials.right] = [wall.materials.right, wall.materials.left];
  if (wall.colors) [wall.colors.left, wall.colors.right] = [wall.colors.right, wall.colors.left];
  doc.comments?.filter((c) => c.targetEntityId === id).forEach((c) => { c.anchor.x = 1 - c.anchor.x; c.anchor.y = 1 - c.anchor.y; });
  for (const o of doc.openings.filter((o) => o.wallId === id)) {
    o.position = 1 - o.position;
    reverseOpeningOrientation(o);
  }
}

/** Reversing the wall reverses both its longitudinal axis and positive normal. */
function reverseOpeningOrientation(opening: Opening): void {
  if (opening.hinge) opening.hinge = opening.hinge === 'left' ? 'right' : 'left';
  if (opening.swing) opening.swing = opening.swing === 'left' ? 'right' : 'left';
}

export function splitWall(
  doc: EditorDocument,
  id: string,
  t: number,
  vertexId: string,
  newWallId: string,
): void {
  if (!Number.isFinite(t) || t <= 0 || t >= 1) throw new Error('Posición de división inválida');
  const wall = requireWall(doc, id);
  const path = wallPath(doc, wall), length = path.length;
  for (const o of doc.openings.filter((o) => o.wallId === id)) {
    const half = o.widthMm / length / 2;
    if (o.position - half < t - EPSILON && o.position + half > t + EPSILON) {
      throw new Error('No se puede dividir a través de una abertura');
    }
    if (o.position < t) o.position /= t;
    else {
      o.position = (o.position - t) / (1 - t);
      o.wallId = newWallId;
    }
  }
  doc.vertices.push({ id: vertexId, ...path.at(t) });
  doc.comments?.filter((c) => c.targetEntityId === id).forEach((c) => {
    if (c.anchor.x < t) c.anchor.x /= t;
    else { c.anchor.x = (c.anchor.x - t) / (1 - t); c.targetEntityId = newWallId; }
  });
  const newWall = { ...structuredClone(wall), id: newWallId, startVertexId: vertexId };
  if (wall.curveHeightMm) {
    const sign = Math.sign(wall.curveHeightMm);
    wall.curveHeightMm = sign * path.radius * (1 - Math.cos(Math.abs(path.sweep) * t / 2));
    newWall.curveHeightMm = sign * path.radius * (1 - Math.cos(Math.abs(path.sweep) * (1 - t) / 2));
  }
  doc.walls.push(newWall);
  wall.endVertexId = vertexId;
  for (const finish of doc.floorFinishes ?? []) {
    const ids = JSON.parse(finish.roomId.slice(5)) as string[];
    if (ids.includes(id)) finish.roomId = `room:${JSON.stringify([...ids, newWallId].sort())}`;
  }
}

export function mergeWalls(doc: EditorDocument, id: string, otherId: string): void {
  if (id === otherId) throw new Error('Se requieren dos muros distintos');
  const first = requireWall(doc, id);
  const second = requireWall(doc, otherId);
  if (first.curveHeightMm || second.curveHeightMm) throw new Error('Convierte las paredes a rectas antes de fusionarlas');
  const shared = [first.startVertexId, first.endVertexId].filter(
    (v) => v === second.startVertexId || v === second.endVertexId,
  );
  if (
    shared.length !== 1 ||
    first.thicknessMm !== second.thicknessMm ||
    first.dimensionalOrigin !== second.dimensionalOrigin
  ) {
    throw new Error('Muros incompatibles para fusionar');
  }
  const join = shared[0]!;
  if (
    doc.walls.some(
      (w) =>
        w.id !== id && w.id !== otherId && (w.startVertexId === join || w.endVertexId === join),
    )
  ) {
    throw new Error('No se puede eliminar una unión con otro muro');
  }
  const otherEnd = second.startVertexId === join ? second.endVertexId : second.startVertexId;
  const startId = first.startVertexId === join ? otherEnd : first.startVertexId;
  const endId = first.endVertexId === join ? otherEnd : first.endVertexId;
  const start = doc.vertices.find((v) => v.id === startId)!;
  const end = doc.vertices.find((v) => v.id === endId)!;
  const pivot = doc.vertices.find((v) => v.id === join)!;
  if (Math.abs(cross(start, end, pivot)) > EPSILON * distance(start, end))
    throw new Error('Muros no colineales');
  const length = distance(start, end);
  const [secondStart, secondEnd] = wallPoints(doc, second);
  const secondReversed = (secondEnd.x - secondStart.x) * (end.x - start.x) +
    (secondEnd.y - secondStart.y) * (end.y - start.y) < 0;
  if (doc.schemaVersion >= 3) {
    const left = secondReversed ? second.materials!.right : second.materials!.left;
    const right = secondReversed ? second.materials!.left : second.materials!.right;
    if (first.heightMm !== second.heightMm || first.materials!.left !== left || first.materials!.right !== right)
      throw new Error('Alturas o materiales incompatibles para fusionar');
    if (doc.schemaVersion >= 4 && (first.colors!.left !== second.colors![secondReversed ? 'right' : 'left'] ||
      first.colors!.right !== second.colors![secondReversed ? 'left' : 'right'])) throw new Error('Colores incompatibles para fusionar');
  }
  for (const c of doc.comments?.filter((c) => c.targetEntityId === id || c.targetEntityId === otherId) ?? []) {
    const center = interpolate(...wallPoints(doc, requireWall(doc, c.targetEntityId)), c.anchor.x);
    if (c.targetEntityId === otherId && secondReversed) c.anchor.y = 1 - c.anchor.y;
    c.anchor.x = ((center.x - start.x) * (end.x - start.x) + (center.y - start.y) * (end.y - start.y)) / length ** 2;
    c.targetEntityId = id;
  }
  for (const o of doc.openings.filter((o) => o.wallId === id || o.wallId === otherId)) {
    const center = interpolate(...wallPoints(doc, requireWall(doc, o.wallId)), o.position);
    if (o.wallId === otherId && secondReversed) reverseOpeningOrientation(o);
    o.position =
      ((center.x - start.x) * (end.x - start.x) + (center.y - start.y) * (end.y - start.y)) /
      (length * length);
    o.wallId = id;
  }
  first.startVertexId = startId;
  first.endVertexId = endId;
  doc.walls = doc.walls.filter((w) => w.id !== otherId);
  doc.vertices = doc.vertices.filter((v) => v.id !== join);
  for (const finish of doc.floorFinishes ?? []) {
    const ids = JSON.parse(finish.roomId.slice(5)) as string[];
    if (ids.includes(otherId)) finish.roomId = `room:${JSON.stringify([...new Set(ids.map((wallId) => wallId === otherId ? id : wallId))].sort())}`;
  }
}
