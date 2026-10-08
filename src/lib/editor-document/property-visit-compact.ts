import type { PropertyVisitFrame, PropertyVisitPlan } from './property-visit-types';

export const PROPERTY_VISIT_MAX_SECONDS = 60;
export const PROPERTY_VISIT_CLIP_SECONDS = 6;

/** Agrupa la ruta completa, sin cortar el final ni sustituir curvas por líneas que atraviesan paredes. */
export function compactPropertyVisit(plan: PropertyVisitPlan): PropertyVisitPlan {
  if (!plan.complete || plan.frames.length < 2) return plan;
  const pathFrames = plan.frames;
  const cumulative = [0];
  for (const frame of pathFrames.slice(1)) cumulative.push(cumulative.at(-1)! + frame.secondsFromPrevious);
  const total = cumulative.at(-1)!;
  const clips = Math.min(10, Math.max(1, Math.ceil(total / PROPERTY_VISIT_CLIP_SECONDS)), pathFrames.length - 1);
  const indices = [0];
  for (let clip = 1; clip < clips; clip++) {
    const min = indices.at(-1)! + 1, max = pathFrames.length - (clips - clip) - 1;
    const target = total * clip / clips;
    let best = min;
    for (let index = min + 1; index <= max; index++) {
      if (Math.abs(cumulative[index]! - target) < Math.abs(cumulative[best]! - target)) best = index;
    }
    indices.push(best);
  }
  indices.push(pathFrames.length - 1);
  const frames: PropertyVisitFrame[] = indices.map((index, shot) => ({ ...pathFrames[index]!,
    secondsFromPrevious: shot ? PROPERTY_VISIT_CLIP_SECONDS : 0 }));
  return { ...plan, frames, pathFrames, durationSeconds: clips * PROPERTY_VISIT_CLIP_SECONDS };
}
