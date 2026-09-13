import type { Point, Stair } from './schema';
import { localToWorld } from './spatial-properties';

export interface StairArrival {
  point: Point;
  direction: Point;
  elevationMm: number;
  widthMm: number;
}

/** Lower entry point of a straight stair: this is where a ramp can continue into its first step. */
export function straightStairEntry(stair: Stair): StairArrival | null {
  if (stair.kind !== 'straight') return null;
  const radians = stair.rotation * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  return { point: localToWorld(stair, { x: stair.widthMm / 2, y: stair.depthMm }),
    direction: { x: -sin, y: cos }, elevationMm: stair.elevationMm, widthMm: stair.widthMm };
}

/** La salida superior real de una escalera, incluida la dirección del último tramo. */
export function stairArrival(stair: Stair): StairArrival {
  const flightMm = stair.kind === 'U' ? stair.widthMm / 2 : Math.min(stair.widthMm, stair.depthMm) / 3;
  const local = stair.kind === 'straight'
    ? { point: { x: stair.widthMm / 2, y: 0 }, direction: { x: 0, y: -1 }, widthMm: stair.widthMm }
    : stair.kind === 'L'
      ? { point: { x: stair.widthMm, y: flightMm / 2 }, direction: { x: 1, y: 0 }, widthMm: flightMm }
      : { point: { x: stair.widthMm - flightMm / 2, y: stair.depthMm }, direction: { x: 0, y: 1 }, widthMm: flightMm };
  const radians = stair.rotation * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  return { point: localToWorld(stair, local.point),
    direction: { x: local.direction.x * cos - local.direction.y * sin, y: local.direction.x * sin + local.direction.y * cos },
    elevationMm: stair.elevationMm + stair.heightMm, widthMm: local.widthMm };
}
