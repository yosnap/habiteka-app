import type { Point, Ramp } from './schema';
import { rampArrival } from './ramp-arrival';
import { rampParts } from './ramp-route';
import { isRampLanding } from './ramp-kind';
import { localToWorld } from './spatial-properties';

/** Fits a standalone landing flush to the upper edge of a ramp's final flight. */
export function placeLandingAtRampArrival(landing: Ramp, ramp: Ramp): Ramp {
  if (!isRampLanding(landing) || isRampLanding(ramp)) return landing;
  const arrival = rampArrival(ramp), lastFlight = rampParts(ramp).filter((part) => part.kind === 'flight').at(-1)!;
  const rotation = ramp.rotation + lastFlight.rotation, radians = rotation * Math.PI / 180;
  const widthMm = ramp.widthMm, widthAxis = { x: Math.cos(radians), y: Math.sin(radians) };
  const depthAxis = { x: -Math.sin(radians), y: Math.cos(radians) };
  return { ...landing, widthMm, elevationMm: arrival.elevationMm, rotation,
    x: arrival.point.x - widthAxis.x * widthMm / 2 - depthAxis.x * landing.depthMm,
    y: arrival.point.y - widthAxis.y * widthMm / 2 - depthAxis.y * landing.depthMm };
}

/** Resizes a ramp or landing from the dragged corner, preserving the opposite anchor. */
export function resizeRampFromCorner(ramp: Ramp, corner: number, pointer: Point): Ramp {
  const radians = ramp.rotation * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const local = { x: (pointer.x - ramp.x) * cos + (pointer.y - ramp.y) * sin,
    y: -(pointer.x - ramp.x) * sin + (pointer.y - ramp.y) * cos };
  const opposite = [[ramp.widthMm, ramp.depthMm], [0, ramp.depthMm], [0, 0], [ramp.widthMm, 0]][corner];
  if (!opposite) return ramp;
  const widthMm = Math.max(50, Math.abs(local.x - opposite[0]!)), depthMm = Math.max(50, Math.abs(local.y - opposite[1]!));
  const origin = localToWorld(ramp, { x: Math.min(local.x, opposite[0]!), y: Math.min(local.y, opposite[1]!) });
  return { ...ramp, x: origin.x, y: origin.y, widthMm, depthMm };
}
