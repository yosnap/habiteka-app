import { z } from 'zod';
import { renderDesignOptionsSchema } from '@/lib/editor-document/render-design-options';

export const NATIVE_RENDER_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;
export const conceptRenderSettingsSchema = z.object({
  options: renderDesignOptionsSchema.optional(),
  batchId: z.string().uuid().optional(),
  qualityAck: z.boolean().optional(),
  styleAnchor: z.boolean().optional(),
  orthophotoDataUrl: z.string().max(14_000_000).optional(),
  existingImageDataUrl: z.string().max(14_000_000).regex(NATIVE_RENDER_DATA_URL).optional(),
}).strict();
