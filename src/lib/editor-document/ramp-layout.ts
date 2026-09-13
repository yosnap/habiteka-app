import type { Ramp } from './schema';
import { rampParts } from './ramp-route';

export interface RampLayout {
  slopePercent: number;
  angleDeg: number;
}

/** Validates the physical incline independently from the plan/3D renderers. */
export function rampLayout(ramp: Ramp): RampLayout {
  const { widthMm, depthMm, riseMm, elevationMm, rotation } = ramp;
  if (![widthMm, depthMm, riseMm].every((value) => Number.isFinite(value) && value > 0)
    || !Number.isFinite(elevationMm) || elevationMm < 0 || !Number.isFinite(rotation))
    throw new Error('Dimensiones de rampa inválidas');
  const flights = rampParts(ramp).filter((part) => part.kind === 'flight');
  const length = flights.reduce((total, part) => total + part.depthMm, 0);
  const totalRiseMm = flights.reduce((total, part) => total + part.riseMm, 0);
  return { slopePercent: totalRiseMm / length * 100, angleDeg: Math.atan2(totalRiseMm, length) * 180 / Math.PI };
}
