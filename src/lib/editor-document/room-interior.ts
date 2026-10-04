import type { EditorDocument, Point, Wall } from './schema';
import type { DerivedRoom } from './rooms';
import { inwardNormal } from './light-strip-geometry';
import { pointInPolygon } from './polygon-tools';
import { wallPath } from './wall-path';

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Muro de la estancia que recorre el tramo a-b de su contorno (que pasa por el eje de los muros). */
export function nearestRoomWall(doc: EditorDocument, room: DerivedRoom, a: Point, b: Point): Wall | undefined {
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  let best: { distance: number; wall?: Wall } = { distance: Infinity };
  for (const id of room.wallIds) {
    const wall = doc.walls.find((item) => item.id === id);
    if (!wall) continue;
    const samples = wallPath(doc, wall).samples();
    for (let index = 1; index < samples.length; index++) {
      const distance = distanceToSegment(middle, samples[index - 1]!, samples[index]!);
      if (distance < best.distance) best = { distance, wall };
    }
  }
  return best.wall;
}

/** Tramo de cara interior de un muro de la estancia, en el mismo orden que su contorno. */
export interface InteriorEdge { a: Point; b: Point; wall?: Wall }

/**
 * Caras interiores, una por tramo del contorno: cada tramo se retranquea medio grueso de su muro y se corta con sus
 * vecinos. Entre dos muros alineados de distinto grueso la cara hace un escalón, no una diagonal.
 */
export function roomInteriorEdges(doc: EditorDocument, room: DerivedRoom): InteriorEdge[] {
  const polygon = room.boundary;
  if (polygon.length < 3) return [];
  const lines = polygon.map((a, index) => {
    const b = polygon[(index + 1) % polygon.length]!, normal = inwardNormal(a, b, polygon), wall = nearestRoomWall(doc, room, a, b);
    const inset = wall && !wall.hidden ? wall.thicknessMm / 2 : 0;
    return { wall, offset: { x: normal.x * inset, y: normal.y * inset }, from: a, to: b, dir: { x: b.x - a.x, y: b.y - a.y } };
  });
  const corner = (previous: typeof lines[number], current: typeof lines[number]) => {
    const start = { x: current.from.x + current.offset.x, y: current.from.y + current.offset.y };
    const cross = previous.dir.x * current.dir.y - previous.dir.y * current.dir.x;
    if (Math.abs(cross) < 1e-9) return null;
    const origin = { x: previous.from.x + previous.offset.x, y: previous.from.y + previous.offset.y };
    const t = ((start.x - origin.x) * current.dir.y - (start.y - origin.y) * current.dir.x) / cross;
    return { x: origin.x + previous.dir.x * t, y: origin.y + previous.dir.y * t };
  };
  return lines.map((line, index) => {
    const previous = lines[(index - 1 + lines.length) % lines.length]!, next = lines[(index + 1) % lines.length]!;
    return { wall: line.wall,
      a: corner(previous, line) ?? { x: line.from.x + line.offset.x, y: line.from.y + line.offset.y },
      b: corner(line, next) ?? { x: line.to.x + line.offset.x, y: line.to.y + line.offset.y } };
  });
}

/**
 * Suelo útil de una estancia: su contorno pasa por el eje de los muros y cada tramo se retranquea medio grosor de su
 * muro. Quien coloca muebles necesita las caras interiores: arrimar una cama al eje la metía media pared dentro.
 * Si el retranqueo deja un contorno inválido, devuelve el del eje.
 */
export function roomInterior(doc: EditorDocument, room: DerivedRoom): Point[] {
  const polygon = room.boundary, result: Point[] = [];
  for (const { a, b } of roomInteriorEdges(doc, room))
    for (const point of [a, b]) {
      const last = result.at(-1);
      if (!last || Math.hypot(last.x - point.x, last.y - point.y) > .5) result.push(point);
    }
  if (result.length > 2 && Math.hypot(result[0]!.x - result.at(-1)!.x, result[0]!.y - result.at(-1)!.y) <= .5) result.pop();
  return result.length > 2 && result.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && pointInPolygon(point, polygon)) ? result : polygon;
}
