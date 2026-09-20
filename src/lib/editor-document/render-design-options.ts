import { z } from 'zod';

export const RENDER_VIEWS = ['current', 'top', 'isometric', 'front', 'back', 'left', 'right', 'drone'] as const;
export const RENDER_VIEW_LABELS: Record<(typeof RENDER_VIEWS)[number], string> = { current: 'Vista actual', top: 'Cenital', isometric: 'Isométrica', front: 'Frontal', back: 'Trasera', left: 'Izquierda', right: 'Derecha', drone: 'Dron' };
export const RENDER_ADDITIONS = ['plants', 'mirrors', 'lights', 'furniture', 'decor'] as const;
export const RENDER_ADDITION_LABELS = { plants: 'Plantas', mirrors: 'Espejos', lights: 'Lámparas e iluminación decorativa', furniture: 'Muebles', decor: 'Otros objetos decorativos' };
export const renderDesignOptionsSchema = z.object({
  lighting: z.enum(['daylight', 'warm', 'evening']).default('daylight'),
  freedom: z.enum(['strict', 'controlled', 'free']).default('strict'),
  additions: z.array(z.enum(RENDER_ADDITIONS)).max(5).default([]),
  placement: z.enum(['all', 'selected']).default('all'),
  regions: z.array(z.object({
    id: z.string().min(1).max(100), name: z.string().min(1).max(80),
    polygon: z.array(z.object({ x: z.number().finite(), y: z.number().finite() })).min(3).max(20),
  })).max(12).default([]),
  views: z.array(z.enum(RENDER_VIEWS)).min(1).max(8).default(['current']),
}).superRefine((value, ctx) => {
  if (new Set(value.views).size !== value.views.length) ctx.addIssue({ code: 'custom', path: ['views'], message: 'No repitas vistas.' });
  if (value.freedom !== 'strict' && value.placement === 'selected' && !value.regions.length)
    ctx.addIssue({ code: 'custom', path: ['regions'], message: 'Marca al menos una zona permitida en el plano.' });
});
export type RenderDesignOptions = z.infer<typeof renderDesignOptionsSchema>;
export type RenderViewChoice = RenderDesignOptions['views'][number];
export const defaultRenderDesignOptions = (): RenderDesignOptions => ({ lighting: 'daylight', freedom: 'strict', additions: [], placement: 'all', regions: [], views: ['current'] });

export interface RenderGeneratedResult {
  id?: string;
  assetUrl: string;
  generation?: { provider: string; model: string; fallbackIndex: number };
}
