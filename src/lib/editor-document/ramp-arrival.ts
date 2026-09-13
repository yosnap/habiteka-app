import type { EditorDocument, Point, Ramp, Wall } from './schema';
import { distance } from './geometry';
import { rampParts } from './ramp-route';
import { deriveRooms, type DerivedRoom } from './rooms';
import { wallPath } from './wall-path';

export interface RampArrival {
  point: Point;
  direction: Point;
  elevationMm: number;
}
export interface RampArrivalTarget {
  wall: Wall;
  position: number;
  room: DerivedRoom;
}

/** The end of the arrow: the upper edge of the last ramp flight. */
export function rampArrival(ramp: Ramp): RampArrival {
  const part = rampParts(ramp).at(-1)!;
  const partAngle = part.rotation * Math.PI / 180, angle = (ramp.rotation + part.rotation) * Math.PI / 180;
  const x = part.x + ramp.widthMm / 2 * Math.cos(partAngle);
  const y = part.y + ramp.widthMm / 2 * Math.sin(partAngle);
  return { point: { x: ramp.x + x * Math.cos(ramp.rotation * Math.PI / 180) - y * Math.sin(ramp.rotation * Math.PI / 180),
    y: ramp.y + x * Math.sin(ramp.rotation * Math.PI / 180) + y * Math.cos(ramp.rotation * Math.PI / 180) },
  direction: { x: Math.sin(angle), y: -Math.cos(angle) }, elevationMm: part.elevationMm + part.riseMm };
}

export function rampArrivalTarget(doc: EditorDocument, ramp: Ramp): RampArrivalTarget | null {
  const arrival = rampArrival(ramp);
  const candidates = doc.walls.map((wall) => {
    const path = wallPath(doc, wall), position = path.project(arrival.point);
    return { wall, position, gap: distance(arrival.point, path.at(position)) };
  }).filter(({ wall, gap }) => gap <= wall.thicknessMm / 2 + 250).sort((a, b) => a.gap - b.gap || a.wall.id.localeCompare(b.wall.id));
  const hit = candidates[0];
  if (hit) {
    const intoRoom = { x: arrival.point.x + arrival.direction.x * (hit.wall.thicknessMm / 2 + 100),
      y: arrival.point.y + arrival.direction.y * (hit.wall.thicknessMm / 2 + 100) };
    const room = deriveRooms(doc).find((candidate) => candidate.wallIds.includes(hit.wall.id) && pointInPolygon(intoRoom, candidate.boundary));
    if (room) return { wall: hit.wall, position: hit.position, room };
  }
  return crossedRoomEntrance(doc, ramp, arrival);
}

/** Finds the wall crossed when the final flight terminates inside its destination room. */
function crossedRoomEntrance(doc: EditorDocument, ramp: Ramp, arrival: RampArrival): RampArrivalTarget | null {
  const room = deriveRooms(doc).find((candidate) => pointInPolygon(arrival.point, candidate.boundary));
  if (!room) return null;
  const lastFlight = rampParts(ramp).filter((part) => part.kind === 'flight').at(-1)!;
  const start = { x: arrival.point.x - arrival.direction.x * lastFlight.depthMm,
    y: arrival.point.y - arrival.direction.y * lastFlight.depthMm };
  const crossing = boundaryEntry(start, arrival.point, room.boundary);
  if (!crossing) return null;
  const candidates = doc.walls.filter((wall) => room.wallIds.includes(wall.id)).map((wall) => {
    const path = wallPath(doc, wall), position = path.project(crossing);
    return { wall, position, gap: distance(crossing, path.at(position)) };
  }).sort((a, b) => a.gap - b.gap || a.wall.id.localeCompare(b.wall.id));
  const hit = candidates[0];
  return hit && hit.gap <= hit.wall.thicknessMm / 2 + 5 ? { wall: hit.wall, position: hit.position, room } : null;
}

function boundaryEntry(from: Point, to: Point, boundary: Point[]): Point | null {
  let previous = pointInPolygon(from, boundary);
  for (let index = 1; index <= 96; index++) {
    const t = index / 96, current = interpolate(from, to, t), inside = pointInPolygon(current, boundary);
    if (!previous && inside) {
      let low = (index - 1) / 96, high = t;
      for (let iteration = 0; iteration < 24; iteration++) {
        const middle = (low + high) / 2;
        if (pointInPolygon(interpolate(from, to, middle), boundary)) high = middle; else low = middle;
      }
      return interpolate(from, to, high);
    }
    previous = inside;
  }
  return null;
}

function interpolate(from: Point, to: Point, t: number): Point {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

function pointInPolygon(point: Point, boundary: Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = boundary.length - 1; index < boundary.length; previous = index++) {
    const a = boundary[index]!, b = boundary[previous]!;
    if (a.y > point.y !== b.y > point.y && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
