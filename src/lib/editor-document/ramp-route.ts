import type { Point, Ramp } from './schema';
import { isRampLanding } from './ramp-kind';

export interface RampPart { kind: 'flight' | 'landing'; x: number; y: number; rotation: number; depthMm: number; riseMm: number; elevationMm: number; }
/** Local route parts; legacy ramps remain a single flight. */
export function rampParts(ramp: Ramp): RampPart[] {
  const route = ramp.route;
  if (!route) return [{ kind: isRampLanding(ramp) ? 'landing' : 'flight', x: 0, y: 0, rotation: 0, depthMm: ramp.depthMm, riseMm: ramp.riseMm, elevationMm: ramp.elevationMm }];
  const landingMm = ramp.widthMm;
  // `riseMm` is the first flight's rise. The second flight starts at the
  // landing's finished level and contributes its own additional rise.
  const firstRise = ramp.riseMm, first = { kind: 'flight' as const, x: 0, y: 0, rotation: 0,
    depthMm: ramp.depthMm, riseMm: firstRise, elevationMm: ramp.elevationMm };
  // La flecha avanza desde y=depth hacia y=0; el descansillo continúa tras ese extremo de salida.
  const landingOffset = route.landingOffset ?? { x: 0, y: 0 }, secondOffset = route.secondOffset ?? { x: 0, y: 0 };
  const landing = { kind: 'landing' as const, x: landingOffset.x, y: -landingMm + landingOffset.y,
    rotation: 0, depthMm: landingMm, riseMm: 0, elevationMm: ramp.elevationMm + firstRise };
  const turn = route.turn === 'left' ? -90 : route.turn === 'right' ? 90 : 180;
  const secondStart = route.turn === 'left'
    ? { x: landing.x - route.secondDepthMm, y: landing.y + landingMm }
    : route.turn === 'right'
      ? { x: landing.x + ramp.widthMm + route.secondDepthMm, y: landing.y }
      : { x: landing.x + ramp.widthMm, y: landing.y + landingMm };
  return [first, landing, { kind: 'flight', x: secondStart.x + secondOffset.x, y: secondStart.y + secondOffset.y, rotation: turn,
    depthMm: route.secondDepthMm, riseMm: route.secondRiseMm, elevationMm: ramp.elevationMm + firstRise }];
}

/** Physical footprint of a route part in document coordinates. */
export function rampPartFootprint(ramp: Ramp, part: RampPart): Point[] {
  const localAngle = part.rotation * Math.PI / 180, baseAngle = ramp.rotation * Math.PI / 180;
  return [{ x: 0, y: 0 }, { x: ramp.widthMm, y: 0 }, { x: ramp.widthMm, y: part.depthMm }, { x: 0, y: part.depthMm }]
    .map((point) => ({ x: part.x + point.x * Math.cos(localAngle) - point.y * Math.sin(localAngle),
      y: part.y + point.x * Math.sin(localAngle) + point.y * Math.cos(localAngle) }))
    .map((point) => ({ x: ramp.x + point.x * Math.cos(baseAngle) - point.y * Math.sin(baseAngle),
      y: ramp.y + point.x * Math.sin(baseAngle) + point.y * Math.cos(baseAngle) }));
}
