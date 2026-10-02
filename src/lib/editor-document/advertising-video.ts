import { z } from 'zod';
import { videoFormatSchema } from './video-format';

export const advertisingVideoSchema = z.object({
  format: videoFormatSchema,
  dimensionMode: z.enum(['none', 'animated', 'start', 'fixed']),
}).strict();
export type AdvertisingVideoOptions = z.infer<typeof advertisingVideoSchema>;
export const DEFAULT_ADVERTISING_VIDEO: AdvertisingVideoOptions = { format: 'horizontal', dimensionMode: 'none' };
export const ADVERTISING_DIMENSIONS = [
  { value: 'none', label: 'Sin medidas' }, { value: 'animated', label: 'Animadas' },
  { value: 'start', label: 'Solo al inicio' }, { value: 'fixed', label: 'Fijas' },
] as const;
