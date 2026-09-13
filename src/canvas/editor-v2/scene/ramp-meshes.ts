import type { Ramp } from '@/lib/editor-document/schema';
import { rampLayout } from '@/lib/editor-document/ramp-layout';
import { rampParts } from '@/lib/editor-document/ramp-route';
import { materialColor, meters, type SceneRamp } from './types';

/** A triangular prism keeps the 3D surface genuinely continuous, not stepped. */
export function rampMesh(ramp: Ramp): SceneRamp[] {
  rampLayout(ramp);
  const base = ramp.rotation * Math.PI / 180;
  return rampParts(ramp).map((part, index) => {
    const partAngle = part.rotation * Math.PI / 180;
    // Cada tramo puede girar respecto a la rampa principal: su centro se obtiene
    // tras aplicar ese giro local, igual que el Group de la vista 2D.
    const centerX = part.x + ramp.widthMm / 2 * Math.cos(partAngle) - part.depthMm / 2 * Math.sin(partAngle);
    const centerY = part.y + ramp.widthMm / 2 * Math.sin(partAngle) + part.depthMm / 2 * Math.cos(partAngle);
    return { id: `${ramp.id}:${index}`, sourceEntityId: ramp.id,
      position: [meters(ramp.x + centerX * Math.cos(base) - centerY * Math.sin(base)), meters(ramp.elevationMm),
        meters(ramp.y + centerX * Math.sin(base) + centerY * Math.cos(base))],
      width: meters(ramp.widthMm), depth: meters(part.depthMm), rise: meters(part.riseMm),
      baseHeight: meters(part.elevationMm - ramp.elevationMm), rotation: -(base + partAngle),
      color: ramp.color ?? materialColor(ramp.materialId) };
  });
}
