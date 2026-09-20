import { z } from 'zod';
import { Quaternion, Vector3 } from 'three';
import type { RenderView } from '@/lib/editor-document/render-view';

const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const vector = z.tuple([coordinate, coordinate, coordinate]);
/** Coordenadas en metros relativas a la planta identificada por levelId. */
export const cameraPoseSchema = z.object({
  position: vector,
  focus: vector,
  fovDeg: z.number().min(10).max(120),
  levelId: z.string().min(1).max(200).nullable(),
}).strict().refine((value) => value.position.some((n, i) => Math.abs(n - value.focus[i]!) > 0.000001), {
  message: 'La cámara necesita una dirección de mirada.', path: ['focus'],
});
export type CameraPose = z.infer<typeof cameraPoseSchema>;

/** Las capturas antiguas pueden recuperar la dirección a partir de su quaternion. */
export function cameraPoseFromView(view: RenderView): CameraPose {
  const quaternion = new Quaternion(...view.quaternion);
  if (quaternion.lengthSq() < 0.000001) throw new Error('Orientación de cámara inválida');
  const focus = view.focus ?? new Vector3(0, 0, -1).applyQuaternion(quaternion.normalize())
    .add(new Vector3(...view.position)).toArray();
  const position: [number, number, number] = [...view.position], target: [number, number, number] = [...focus];
  const elevation = view.levelElevationM ?? 0;
  position[1] -= elevation; target[1] -= elevation;
  return cameraPoseSchema.parse({ position, focus: target, fovDeg: view.fov, levelId: view.levelId ?? null });
}
