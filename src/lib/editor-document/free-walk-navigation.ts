import type { Point } from './schema';
import type { walkthroughNavigation } from './walkthrough-navigation';

type Navigation = ReturnType<typeof walkthroughNavigation>;

/** Busca un ojo libre en la estancia elegida antes de activar la cámara. */
export function freeWalkStart(nav: Navigation, preferred?: Point): Point | null {
  if (preferred && nav.free(preferred)) return preferred;
  const preferredRoomId = preferred && nav.roomAt(preferred)?.id;
  const rooms = preferredRoomId
    ? [...nav.rooms].sort((a, b) => Number(b.id === preferredRoomId) - Number(a.id === preferredRoomId))
    : nav.rooms;
  for (const room of rooms) {
    const xs = room.boundary.map((p) => p.x), ys = room.boundary.map((p) => p.y);
    const center = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    const candidates: Point[] = [center];
    for (let x = Math.min(...xs) + 200; x < Math.max(...xs); x += 250)
      for (let y = Math.min(...ys) + 200; y < Math.max(...ys); y += 250) candidates.push({ x, y });
    candidates.sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y));
    for (const point of candidates) if (nav.roomAt(point)?.id === room.id && nav.free(point)) return point;
  }
  return null;
}

/** Paso corto con radio de cámara, barrido continuo y deslizamiento por ejes. */
export function moveFreeWalk(nav: Navigation, from: Point, delta: Point): Point {
  const length = Math.hypot(delta.x, delta.y);
  const steps = Math.max(1, Math.ceil(length / 40));
  let point = from;
  for (let i = 0; i < steps; i++) {
    const dx = delta.x / steps, dy = delta.y / steps;
    const whole = { x: point.x + dx, y: point.y + dy };
    if (nav.segmentFree(point, whole)) { point = whole; continue; }
    const alongX = { x: point.x + dx, y: point.y };
    if (nav.segmentFree(point, alongX)) point = alongX;
    const alongY = { x: point.x, y: point.y + dy };
    if (nav.segmentFree(point, alongY)) point = alongY;
  }
  return point;
}
