import { z } from 'zod';

export const VIDEO_TITLE_MAX = 100;
/** Un nombre vacío conserva la etiqueta automática de los vídeos antiguos. */
export const videoTitleSchema = z.string().trim().max(VIDEO_TITLE_MAX, 'El nombre admite hasta 100 caracteres.')
  .refine(value => !/[\u0000-\u001f\u007f]/.test(value), 'El nombre no admite caracteres de control.').optional();
export function readVideoTitle(payload: unknown): string | null {
  const result = videoTitleSchema.safeParse(payload && typeof payload === 'object' ? (payload as { title?: unknown }).title : undefined);
  return result.success && result.data ? result.data : null;
}
