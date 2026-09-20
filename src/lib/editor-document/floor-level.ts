import type { EditorDocument, Point, Wall } from './schema';
import { deriveRoomsSafe, type DerivedRoom } from './rooms';
import { floorFinish } from './floor-finishes';
import { insideRoom } from './ceiling-geometry';
import { wallPoints } from './geometry';

const elevationOf = (doc: EditorDocument, room: DerivedRoom) => floorFinish(doc, room.id).elevationMm ?? 0;

/** Cota del suelo en un punto del plano: la de la estancia que lo contiene, o 0 fuera de toda estancia. */
export function floorElevationAt(doc: EditorDocument, point: Point, rooms = deriveRoomsSafe(doc)): number {
  const room = rooms.find((candidate) => insideRoom(point, candidate.boundary));
  return room ? elevationOf(doc, room) : 0;
}

/**
 * Cota de referencia de un muro: el suelo más alto de las estancias que lo comparten. Para un muro recién
 * trazado que aún no cierra nada, la estancia que contiene su punto medio.
 */
export function wallFloorElevation(doc: EditorDocument, wall: Wall, rooms = deriveRoomsSafe(doc)): number {
  const adjacent = rooms.filter((room) => room.wallIds.includes(wall.id));
  if (adjacent.length) return Math.max(...adjacent.map((room) => elevationOf(doc, room)));
  const [a, b] = wallPoints(doc, wall);
  return floorElevationAt(doc, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, rooms);
}

/**
 * Cuando un muro nuevo divide una estancia, las estancias hijas heredan el acabado y la cota del suelo de la
 * estancia que ocupaban antes; sin esto nacerían a cota 0 y con el suelo por defecto.
 */
export function inheritFloorFinishes(previous: EditorDocument, candidate: EditorDocument): EditorDocument {
  const before = deriveRoomsSafe(previous), after = deriveRoomsSafe(candidate);
  if (!before.length || !after.length) return candidate;
  const finishes = candidate.floorFinishes ?? [];
  const missing = after.filter((room) => !finishes.some((finish) => finish.roomId === room.id));
  if (!missing.length) return candidate;
  const inherited = missing.flatMap((room) => {
    const centre = interiorPoint(room.boundary);
    const parent = before.find((candidateRoom) => insideRoom(centre, candidateRoom.boundary));
    const finish = parent && (previous.floorFinishes ?? []).find((item) => item.roomId === parent.id);
    return finish ? [{ ...finish, roomId: room.id }] : [];
  });
  return inherited.length ? { ...candidate, floorFinishes: [...finishes, ...inherited] } : candidate;
}

/** Punto interior de un polígono simple: el centroide si cae dentro; si no, el centro del primer triángulo interior. */
function interiorPoint(polygon: Point[]): Point {
  const centroid = { x: polygon.reduce((s, p) => s + p.x, 0) / polygon.length, y: polygon.reduce((s, p) => s + p.y, 0) / polygon.length };
  if (insideRoom(centroid, polygon)) return centroid;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!, c = polygon[(i + 2) % polygon.length]!;
    const p = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    if (insideRoom(p, polygon)) return p;
  }
  return centroid;
}
