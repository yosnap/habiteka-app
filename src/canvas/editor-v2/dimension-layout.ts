import type { EditorDocument, Point, Wall } from '@/lib/editor-document/schema';
import type { DerivedRoom } from '@/lib/editor-document/rooms';
import { distance, wallPoints } from '@/lib/editor-document/geometry';
import { wallPath } from '@/lib/editor-document/wall-path';

export interface DimensionLayout {
  from: Point;
  to: Point;
  sourceFrom: Point;
  sourceTo: Point;
}
/** A single bounded face determines the exterior regardless of wall direction. */
export function wallDimensionLayout(doc: EditorDocument, wall: Wall, rooms: DerivedRoom[], scale: number): DimensionLayout {
  const [sourceFrom, sourceTo] = wallPoints(doc, wall);
  const faces = rooms.filter((room) => room.wallIds.includes(wall.id));
  let a = sourceFrom, b = sourceTo;
  if (faces.length === 1) {
    const face = faces[0]!, index = face.wallIds.indexOf(wall.id);
    a = doc.vertices.find((v) => v.id === face.vertexIds[index])!;
    b = doc.vertices.find((v) => v.id === face.vertexIds[(index + 1) % face.vertexIds.length])!;
  } else if (a.x > b.x || (a.x === b.x && a.y > b.y)) {
    // Shared/open walls have no unique exterior; fixed world ordering avoids flips on inversion.
    [a, b] = [b, a];
  }
  const length = Math.max(.001, distance(a, b)), midpoint = wallPath(doc, wall).at(.5);
  const bulge = ((midpoint.x - (a.x + b.x) / 2) * (b.y - a.y) - (midpoint.y - (a.y + b.y) / 2) * (b.x - a.x)) / length;
  const offset = wall.thicknessMm / 2 + 36 / scale + Math.max(0, bulge);
  const delta = { x: (b.y - a.y) / length * offset, y: -(b.x - a.x) / length * offset };
  return { sourceFrom, sourceTo, from: { x: sourceFrom.x + delta.x, y: sourceFrom.y + delta.y },
    to: { x: sourceTo.x + delta.x, y: sourceTo.y + delta.y } };
}
