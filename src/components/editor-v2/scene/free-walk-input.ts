import type { Point } from '@/lib/editor-document/schema';

export const LOOK_RADIANS_PER_PIXEL = .0025;

/** Eje lateral de la cámara: al mirar hacia +Z, su derecha apunta hacia -X. */
export function walkDelta(yaw: number, forward: number, strafe: number, distanceMm: number): Point {
  return {
    x: (Math.sin(yaw) * forward - Math.cos(yaw) * strafe) * distanceMm,
    y: (Math.cos(yaw) * forward + Math.sin(yaw) * strafe) * distanceMm,
  };
}

/** WASD sigue la mirada; las flechas siguen los ejes del mini plano fijo. */
export function walkInputDelta(yaw: number, keys: ReadonlySet<string>, touch: { forward: number; strafe: number }, distanceMm: number): Point {
  const relative = walkDelta(yaw,
    Number(keys.has('KeyW')) - Number(keys.has('KeyS')) + touch.forward,
    Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + touch.strafe, 1);
  const x = relative.x + Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
  const y = relative.y + Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'));
  const scale = distanceMm / Math.max(1, Math.hypot(x, y));
  return { x: x * scale, y: y * scale };
}

export function walkPitch(current: number, pointerDeltaY: number, keyboardDirection: number, seconds: number): number {
  return Math.max(-1.35, Math.min(1.35, current - pointerDeltaY * LOOK_RADIANS_PER_PIXEL + keyboardDirection * seconds * 1.2));
}
