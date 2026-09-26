import type { Point } from '@/lib/editor-document/schema';

export const LOOK_RADIANS_PER_PIXEL = .0025;

/** Eje lateral de la cámara: al mirar hacia +Z, su derecha apunta hacia -X. */
export function walkDelta(yaw: number, forward: number, strafe: number, distanceMm: number): Point {
  return {
    x: (Math.sin(yaw) * forward - Math.cos(yaw) * strafe) * distanceMm,
    y: (Math.cos(yaw) * forward + Math.sin(yaw) * strafe) * distanceMm,
  };
}

export function walkPitch(current: number, pointerDeltaY: number, keyboardDirection: number, seconds: number): number {
  return Math.max(-1.35, Math.min(1.35, current - pointerDeltaY * LOOK_RADIANS_PER_PIXEL + keyboardDirection * seconds * 1.2));
}
