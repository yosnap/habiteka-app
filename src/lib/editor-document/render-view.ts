import { z } from 'zod';

const vector = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
export const renderViewSchema = z.object({
  preset: z.enum(['top', 'isometric', 'front', 'back', 'left', 'right', 'drone', 'custom']),
  position: vector,
  quaternion: z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite()]),
  fov: z.number().positive().max(180),
  aspect: z.number().positive().max(20),
  allLevels: z.boolean(),
  cutaway: z.boolean(),
  lighting: z.enum(['daylight', 'warm', 'evening']).optional(),
  cutawayWallIds: z.array(z.string().max(200)).max(10000).optional(),
});
export type RenderView = z.infer<typeof renderViewSchema>;
export interface RenderCapture { dataUrl: string; view: RenderView }
export type CaptureRenderView = (options?: {
  view?: import('./render-design-options').RenderViewChoice;
  lighting?: 'daylight' | 'warm' | 'evening';
  fit?: boolean;
}) => Promise<RenderCapture>;
