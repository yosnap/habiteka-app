import { sameCameraPose } from '@/lib/contracts/storyboard-image';
import type { CameraPose } from '@/lib/contracts/walkthrough-keyframe';
import type { LightingPreset } from '@/lib/lighting-preset';
import type { PropertyVisitPlan } from './property-visit-types';

export interface PropertyVisitReference {
  id: string; camera: CameraPose; lighting: LightingPreset;
  batchId: string | null; issue?: string;
}

/** Una foto de la habitación no acredita el encuadre de un umbral o un giro. */
export function propertyVisitReferenceCoverage(plan: PropertyVisitPlan, references: PropertyVisitReference[], lighting: LightingPreset) {
  const matching = plan.frames.map(frame => ({ frameId: frame.id, sourceIds: references.filter(reference =>
    !reference.issue && reference.lighting === lighting && sameCameraPose(reference.camera, frame.camera)).map(reference => reference.id) }));
  const missing = matching.filter(frame => !frame.sourceIds.length).map(frame => frame.frameId);
  // No resuelve conflictos entre imágenes: el conjunto necesita revisión de identidad y aceptación de sus uniones.
  return { matching, missing, matched: matching.length - missing.length };
}
