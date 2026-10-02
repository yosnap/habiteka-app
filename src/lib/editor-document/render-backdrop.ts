import { z } from 'zod';
import type { EditorDocument } from './schema';

export const renderBackdropSchema = z.object({
  deliverableId: z.string().min(1).max(128),
  widthMm: z.number().finite().positive().max(1e8), heightMm: z.number().finite().positive().max(1e8),
  xMm: z.number().finite(), yMm: z.number().finite(),
}).strict();
export type RenderBackdrop = z.infer<typeof renderBackdropSchema>;

export function fitRenderBackdrop(document: EditorDocument, deliverableId: string, aspect: number): RenderBackdrop {
  if (!Number.isFinite(aspect) || aspect <= 0 || aspect > 100) throw new Error('Proporciones de imagen no válidas.');
  const xs = document.vertices.map(point => point.x), ys = document.vertices.map(point => point.y);
  const minX = xs.length ? Math.min(...xs) : 0, maxX = xs.length ? Math.max(...xs) : 10000;
  const minY = ys.length ? Math.min(...ys) : 0, maxY = ys.length ? Math.max(...ys) : 10000;
  const widthMm = Math.max(maxX - minX, (maxY - minY) * aspect, 1000);
  const heightMm = widthMm / aspect;
  return renderBackdropSchema.parse({ deliverableId, widthMm, heightMm,
    xMm: (minX + maxX - widthMm) / 2, yMm: (minY + maxY - heightMm) / 2 });
}
