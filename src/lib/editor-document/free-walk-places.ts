import type { EditorDocument, Point } from './schema';
import type { walkthroughNavigation } from './walkthrough-navigation';
import { CAMERA_CLEARANCE_MM } from './walkthrough-navigation';
import { insideRoom } from './ceiling-geometry';
import { wallPath } from './wall-path';

type Navigation = ReturnType<typeof walkthroughNavigation>;
interface Place { name: string; outdoor: boolean }
interface Portal { point: Point; leftId: string; rightId: string }

/** Nombres y destinos reales del plano; se prepara una sola vez por planta. */
export function freeWalkPlaces(doc: EditorDocument, nav: Navigation) {
  const rooms = new Map<string, Place>(nav.rooms.map((room, index) => {
    const label = doc.labels.find((item) => insideRoom(item, room.boundary))?.text.trim();
    const outdoor = room.wallIds.some((id) => id.startsWith('outdoor:')) ||
      /\b(patio|terraza|jard[ií]n|balc[oó]n|porche|exterior)\b/i.test(label ?? '');
    return [room.id, { name: label || `${outdoor ? 'Patio' : 'Estancia'} ${index + 1}`, outdoor }] as const;
  }));
  const walls = new Map(doc.walls.map((wall) => [wall.id, wall]));
  const portals: Portal[] = doc.openings.flatMap((opening) => {
    if (opening.kind === 'ventana' || (opening.kind === 'puerta' && (opening.openAngleDeg ?? 90) < 75)) return [];
    const wall = walls.get(opening.wallId);
    if (!wall) return [];
    const path = wallPath(doc, wall), point = path.at(opening.position), tangent = path.tangent(opening.position);
    const offset = wall.thicknessMm / 2 + CAMERA_CLEARANCE_MM + 80;
    const left = nav.roomAt({ x: point.x - tangent.y * offset, y: point.y + tangent.x * offset });
    const right = nav.roomAt({ x: point.x + tangent.y * offset, y: point.y - tangent.x * offset });
    return left && right && left.id !== right.id ? [{ point, leftId: left.id, rightId: right.id }] : [];
  });
  return { rooms, portals };
}

export function freeWalkGuidance(
  places: ReturnType<typeof freeWalkPlaces>, nav: Navigation, pose: Point & { yaw: number },
): { current: string; destination?: string; distanceM?: number; arrow?: '↖' | '↑' | '↗' } {
  const currentRoom = nav.roomAt(pose), current = currentRoom && places.rooms.get(currentRoom.id);
  if (!currentRoom) return { current: 'Paso entre estancias' };
  const forward = { x: Math.sin(pose.yaw), y: Math.cos(pose.yaw) };
  const candidates = places.portals.flatMap((portal) => {
    const targetId = portal.leftId === currentRoom.id ? portal.rightId
      : portal.rightId === currentRoom.id ? portal.leftId : null;
    const target = targetId && places.rooms.get(targetId);
    if (!target) return [];
    const dx = portal.point.x - pose.x, dy = portal.point.y - pose.y;
    const distance = Math.hypot(dx, dy), alignment = (dx * forward.x + dy * forward.y) / distance;
    if (distance > 4500 || distance < 1 || alignment < .35) return [];
    const side = (-dx * Math.cos(pose.yaw) + dy * Math.sin(pose.yaw)) / distance;
    const arrow: '↖' | '↑' | '↗' = side < -.3 ? '↖' : side > .3 ? '↗' : '↑';
    return [{ target, distance, score: distance / alignment, arrow }];
  });
  candidates.sort((a, b) => a.score - b.score);
  const closest = candidates[0];
  if (!closest) return { current: current?.name ?? 'Estancia' };
  const name = closest.target.name, lower = name.toLocaleLowerCase('es');
  const destination = closest.target.outdoor
    ? /^(patio|jard[ií]n|porche)\b/i.test(name) ? `Salida al ${lower}`
      : /^(terraza|zona exterior)\b/i.test(name) ? `Salida a la ${lower}` : `Salida: ${name}`
    : `Entrada: ${name}`;
  return { current: current?.name ?? 'Estancia', destination, distanceM: closest.distance / 1000, arrow: closest.arrow };
}
