import type { EditorDocument } from './schema';
import type { WalkthroughPath } from './walkthrough';
import { buildWalkthrough } from './walkthrough-geometry';
import { cameraPoseSchema, type CameraPose } from '@/lib/contracts/walkthrough-keyframe';

/** Una pose por punto: conserva la misma altura, orientación y planta que la reproducción. */
export function walkthroughKeyframes(doc: EditorDocument, route: WalkthroughPath): Array<{ waypointId: string; camera: CameraPose }> {
  const compiled = buildWalkthrough(doc, route);
  if (compiled.invalidSegments.length) throw new Error('Corrige los tramos bloqueados antes de preparar imágenes.');
  return route.waypoints.map((point, index) => {
    const sample = compiled.samples.find((item) => item.waypoint.id === point.id);
    const time = sample?.time ?? (index === route.waypoints.length - 1 ? compiled.durationMs : 0);
    const pose = compiled.samplePose(time);
    return { waypointId: point.id, camera: cameraPoseSchema.parse({ ...pose, fovDeg: 75, levelId: doc.activeLevelId ?? null }) };
  });
}
