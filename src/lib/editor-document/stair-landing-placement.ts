import type { Ramp, Stair } from './schema';
import { isRampLanding } from './ramp-kind';
import { stairArrival, straightStairEntry } from './stair-arrival';
import { placeLandingAtArrival } from './ramp-landing-placement';
import { rampArrival } from './ramp-arrival';

/** Un mismo descansillo puede rematar la escalera sin cambiar su tipo de entidad. */
export function placeLandingAtStairArrival(landing: Ramp, stair: Stair): Ramp {
  if (!isRampLanding(landing)) return landing;
  return placeLandingAtArrival(landing, stairArrival(stair));
}

/** Continúa desde la llegada de una rampa en el primer peldaño de una escalera. */
export function placeStairAtRampArrival(stair: Stair, ramp: Ramp): Stair {
  if (isRampLanding(ramp)) return stair;
  if (stair.kind !== 'straight') return stair;
  const arrival = rampArrival(ramp);
  // The ramp reaches the first step, not the upper exit of the stair.
  const rotation = (Math.atan2(-arrival.direction.x, arrival.direction.y) * 180 / Math.PI + 360) % 360;
  const radians = rotation * Math.PI / 180, widthAxis = { x: Math.cos(radians), y: Math.sin(radians) };
  const depthAxis = { x: -Math.sin(radians), y: Math.cos(radians) };
  return { ...stair, widthMm: ramp.widthMm, elevationMm: arrival.elevationMm, rotation,
    x: cleanMm(arrival.point.x - widthAxis.x * ramp.widthMm / 2 - depthAxis.x * stair.depthMm),
    y: cleanMm(arrival.point.y - widthAxis.y * ramp.widthMm / 2 - depthAxis.y * stair.depthMm) };
}

/** Connection distance uses the actual first step, never the stair's arbitrary origin. */
export function stairRampGap(stair: Stair, ramp: Ramp): number {
  const entry = straightStairEntry(stair);
  if (!entry || isRampLanding(ramp)) return Number.POSITIVE_INFINITY;
  return Math.hypot(entry.point.x - rampArrival(ramp).point.x, entry.point.y - rampArrival(ramp).point.y);
}

function cleanMm(value: number) { return Math.round(value * 1e9) / 1e9; }
