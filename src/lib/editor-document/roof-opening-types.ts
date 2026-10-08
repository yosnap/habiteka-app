import { z } from 'zod';
import type { Point } from './schema';

/** Medidas proyectadas sobre el plano 2D; la superficie 3D sigue la pendiente del tejado. */
export const roofOpeningSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(['glass', 'roof-window', 'chimney']),
  x: z.number().finite().min(-1e7).max(1e7), y: z.number().finite().min(-1e7).max(1e7),
  widthMm: z.number().finite().min(200).max(50000), depthMm: z.number().finite().min(200).max(50000),
  rotation: z.number().finite().min(-360).max(360),
  /** Altura libre sobre el punto más alto de la cubierta bajo la chimenea. */
  heightMm: z.number().finite().min(200).max(5000).optional(),
  /** Contorno normalizado de un cristal antiguo; escalarlo conserva su forma. */
  outline: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict()).min(3).max(100).optional(),
}).strict();
export type RoofOpening = z.infer<typeof roofOpeningSchema>;
export const ROOF_OPENING_LABELS = { glass: 'Cristal de techo', 'roof-window': 'Ventana de techo', chimney: 'Salida de chimenea' } as const;

export function roofOpeningPoints(opening: RoofOpening, insetMm = 0): Point[] {
  const angle = opening.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const outline = opening.outline ?? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  return outline.map(point => {
    const x = insetMm + point.x * (opening.widthMm - insetMm * 2), y = insetMm + point.y * (opening.depthMm - insetMm * 2);
    return { x: opening.x + x * c - y * s, y: opening.y + x * s + y * c };
  });
}
