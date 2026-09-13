import type { Ramp } from './schema';

export const RAMP_LANDING_CATALOG_ID = 'builtin:ramp-landing';

export function isRampLanding(ramp: Pick<Ramp, 'catalogId'>): boolean {
  return ramp.catalogId === RAMP_LANDING_CATALOG_ID;
}
