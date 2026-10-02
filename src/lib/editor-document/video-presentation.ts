import { z } from 'zod';
import { DEFAULT_CONSTRUCTION_SECONDS, type ConstructionDurationSeconds } from './construction-timing';
import { videoFormatSchema, type VideoFormat } from './video-format';

export const VIDEO_DIMENSION_MODES = [
  { value: 'animated', label: 'Animadas', description: 'Las líneas se dibujan una a una y después permanecen.' },
  { value: 'start', label: 'Solo al inicio', description: 'Se muestran durante los primeros cuatro segundos.' },
  { value: 'fixed', label: 'Fijas', description: 'Permanecen ancladas al edificio durante el vídeo.' },
  { value: 'none', label: 'Sin medidas', description: 'No aparecen cotas.' },
] as const;
export type VideoDimensionMode = typeof VIDEO_DIMENSION_MODES[number]['value'];
export interface VideoPresentationOptions {
  soundEffects: boolean; soundVolume: number; showDimensions: boolean;
  contentScope?: import('./video-content-scope').VideoContentScope;
  dimensionMode?: VideoDimensionMode; dimensionOcclusion?: boolean; prompt?: string;
  constructionDurationSeconds?: ConstructionDurationSeconds;
  format?: VideoFormat;
}
export const DEFAULT_VIDEO_PRESENTATION: VideoPresentationOptions = {
  soundEffects: true, soundVolume: .4, showDimensions: true, dimensionMode: 'animated', dimensionOcclusion: true, prompt: '',
  constructionDurationSeconds: DEFAULT_CONSTRUCTION_SECONDS,
};
export const videoPresentationSchema = z.object({
  soundEffects: z.boolean(), soundVolume: z.number().min(0).max(1), showDimensions: z.boolean(),
  contentScope: z.enum(['house', 'all']).optional(), dimensionMode: z.enum(['animated', 'start', 'fixed', 'none']).optional(),
  dimensionOcclusion: z.boolean().optional(), prompt: z.string().trim().max(2000).optional(),
  constructionDurationSeconds: z.union([z.literal(8), z.literal(12)]).optional(),
  format: videoFormatSchema.optional(),
}).strict();

/** Mantiene compatibles los vídeos anteriores, que solo tenían el interruptor de cotas. */
export function videoDimensionMode(options: VideoPresentationOptions): VideoDimensionMode {
  return !options.showDimensions ? 'none' : options.dimensionMode ?? 'fixed';
}
export function dimensionReveal(mode: VideoDimensionMode, elapsedMs: number, index: number) {
  if (mode === 'none') return { progress: 0, opacity: 0 };
  if (mode === 'start') return { progress: 1, opacity: Math.max(0, Math.min(1, elapsedMs / 350, (4000 - elapsedMs) / 650)) };
  return { progress: mode === 'animated' ? Math.max(0, Math.min(1, (elapsedMs - index * 650) / 650)) : 1, opacity: 1 };
}
