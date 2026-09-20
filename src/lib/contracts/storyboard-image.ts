import { cameraPoseSchema, type CameraPose } from './walkthrough-keyframe';
import { z } from 'zod';

export const storyboardImageSchema = z.object({
  waypointId: z.string().min(1).max(200),
  deliverableId: z.string().min(1).max(200),
  camera: cameraPoseSchema,
}).strict();
export type StoryboardImage = z.infer<typeof storyboardImageSchema>;
export interface StoryboardGalleryImage {
  id: string;
  assetUrl: string;
  camera: CameraPose;
  label: string;
}
/** Tolera redondeo de la captura, pero no otra planta, posición o dirección. */
export function sameCameraPose(a: CameraPose, b: CameraPose): boolean {
  if (a.levelId !== b.levelId || Math.abs(a.fovDeg - b.fovDeg) > 0.1) return false;
  if (Math.hypot(...a.position.map((n, i) => n - b.position[i]!)) > 0.02) return false;
  const direction = (pose: CameraPose) => {
    const delta = pose.focus.map((n, i) => n - pose.position[i]!);
    const length = Math.hypot(...delta);
    return delta.map((n) => n / length);
  };
  const da = direction(a), db = direction(b);
  return da.reduce((sum, n, i) => sum + n * db[i]!, 0) > 0.99999;
}
