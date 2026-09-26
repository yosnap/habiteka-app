import type { Point } from '@/lib/editor-document/schema';

export const LOOK_RADIANS_PER_PIXEL = .0025;
export const TURN_RADIANS_PER_SECOND = 1.8;

/** Eje lateral de la cámara: al mirar hacia +Z, su derecha apunta hacia -X. */
export function walkDelta(yaw: number, forward: number, strafe: number, distanceMm: number): Point {
  return {
    x: (Math.sin(yaw) * forward - Math.cos(yaw) * strafe) * distanceMm,
    y: (Math.cos(yaw) * forward + Math.sin(yaw) * strafe) * distanceMm,
  };
}

/** Avanzar y retroceder siempre siguen la mirada; A/D y el mando táctil desplazan de lado. */
export function walkInputDelta(yaw: number, keys: ReadonlySet<string>, touch: { forward: number; strafe: number }, distanceMm: number): Point {
  const relative = walkDelta(yaw,
    Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) + touch.forward,
    Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + touch.strafe, 1);
  const scale = distanceMm / Math.max(1, Math.hypot(relative.x, relative.y));
  return { x: relative.x * scale, y: relative.y * scale };
}

/** Giro hacia la derecha de la cámara: yaw decrece en el sistema de Three.js. */
export function walkTurn(yaw: number, keys: ReadonlySet<string>, touchTurn: number, seconds: number): number {
  const direction = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft')) + touchTurn;
  return yaw - direction * TURN_RADIANS_PER_SECOND * seconds;
}

/** Orienta la entrada hacia el tramo libre más largo cuando no hay destino elegido. */
export function walkOpenFocus(start: Point, segmentFree: (from: Point, to: Point) => boolean): Point {
  let best: Point = { x: start.x, y: start.y + 1000 }, reach = -1;
  for (let direction = 0; direction < 16; direction++) {
    const angle = direction * Math.PI / 8;
    for (let distance = 250; distance <= 5000; distance += 250) {
      const point = { x: start.x + Math.sin(angle) * distance, y: start.y + Math.cos(angle) * distance };
      if (!segmentFree(start, point)) break;
      if (distance > reach) { best = point; reach = distance; }
    }
  }
  return best;
}

/** Busca un seguimiento libre detrás o a un lado, sin atravesar muebles ni muros. */
export function thirdPersonCameraOffset(free: (point: Point) => boolean, point: Point, yaw: number): Point {
  let best = { x: -Math.sin(yaw) * 200, y: -Math.cos(yaw) * 200 }, score = 0;
  for (const angle of [0, -Math.PI / 4, Math.PI / 4, -Math.PI / 2, Math.PI / 2]) {
    const direction = { x: -Math.sin(yaw + angle), y: -Math.cos(yaw + angle) };
    for (const distance of [300, 600, 900, 1200, 1500, 1800]) {
      const offset = { x: direction.x * distance, y: direction.y * distance };
      if (!free({ x: point.x + offset.x, y: point.y + offset.y })) break;
      const nextScore = distance - Math.abs(angle) * 260;
      if (nextScore > score) { best = offset; score = nextScore; }
      if (angle === 0 && distance === 1800) return best;
    }
  }
  return best;
}

export function walkPitch(current: number, pointerDeltaY: number, keyboardDirection: number, seconds: number): number {
  return Math.max(-1.35, Math.min(1.35, current - pointerDeltaY * LOOK_RADIANS_PER_PIXEL + keyboardDirection * seconds * 1.2));
}
