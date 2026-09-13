import type { Ramp, Stair } from './schema';
import { isRampLanding } from './ramp-kind';
import { stairArrival } from './stair-arrival';
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
  const arrival = rampArrival(ramp);
  const rotation = Math.atan2(arrival.direction.x, -arrival.direction.y) * 180 / Math.PI;
  const radians = rotation * Math.PI / 180, widthAxis = { x: Math.cos(radians), y: Math.sin(radians) };
  const depthAxis = { x: -Math.sin(radians), y: Math.cos(radians) };
  return { ...stair, widthMm: ramp.widthMm, elevationMm: arrival.elevationMm, rotation,
    x: arrival.point.x - widthAxis.x * ramp.widthMm / 2 - depthAxis.x * stair.depthMm,
    y: arrival.point.y - widthAxis.y * ramp.widthMm / 2 - depthAxis.y * stair.depthMm };
}
