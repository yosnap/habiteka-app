import { z } from 'zod';
import type { CameraPose } from '@/lib/contracts/walkthrough-keyframe';

const vector = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
export const renderViewSchema = z.object({
  preset: z.enum(['top', 'isometric', 'front', 'back', 'left', 'right', 'drone', 'custom']),
  position: vector,
  focus: vector.optional(),
  levelElevationM: z.number().finite().optional(),
  levelId: z.string().min(1).max(200).nullable().optional(),
  quaternion: z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite()]),
  fov: z.number().positive().max(180),
  aspect: z.number().positive().max(20),
  allLevels: z.boolean(),
  cutaway: z.boolean(),
  ceilingView: z.enum(['hidden', 'transparent', 'solid']).optional(),
  lighting: z.enum(['daylight', 'warm', 'evening']).optional(),
  cutawayWallIds: z.array(z.string().max(200)).max(10000).optional(),
});
export type RenderView = z.infer<typeof renderViewSchema>;
export interface RenderCapture {
  dataUrl: string;
  view: RenderView;
  /** Máscara PNG (blanco = zona permitida visible) desde la misma cámara. */
  maskDataUrl?: string;
}
/** Polígonos de zona en milímetros de planta. */
export type ZoneMaskRegions = ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>;
export type CaptureRenderView = (options?: {
  view?: import('./render-design-options').RenderViewChoice;
  lighting?: 'daylight' | 'warm' | 'evening';
  fit?: boolean;
  camera?: CameraPose;
  maskRegions?: ZoneMaskRegions;
}) => Promise<RenderCapture>;
