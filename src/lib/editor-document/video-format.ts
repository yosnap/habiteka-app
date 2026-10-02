import { z } from 'zod';

export const videoFormatSchema = z.enum(['horizontal', 'vertical']);
export type VideoFormat = z.infer<typeof videoFormatSchema>;
export const VIDEO_FORMATS = [
  { value: 'horizontal', label: 'Horizontal · 16:9' },
  { value: 'vertical', label: 'Vertical · 9:16' },
] as const;
export function videoFormatSize(format: VideoFormat = 'horizontal') {
  return format === 'vertical' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
}

/** Encaja sin deformar ni recortar; los márgenes conservan todas las paredes y accesos. */
export function containVideoRect(sourceWidth: number, sourceHeight: number, width: number, height: number) {
  if (![sourceWidth, sourceHeight, width, height].every(value => Number.isFinite(value) && value > 0))
    throw new Error('Dimensiones de vídeo no válidas.');
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const w = sourceWidth * scale, h = sourceHeight * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}
