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
  /**
   * Estancias para las que se genera una vista interior a altura de ojos. Con la
   * lista vacía manda `views`; con estancias elegidas, cada una es una imagen y
   * `views` se ignora. Es la única forma de obtener perspectivas realistas de un
   * plano: la captura del 3D lleva la geometría, el modelo solo pone el aspecto.
   */
  // El id de estancia enumera sus muros, así que es largo por construcción.
  interiorRoomIds: z.array(z.string().min(1).max(4000)).max(12).default([]),
  designScope: z.enum(['all', 'interior', 'exterior', 'rooms', 'zone']).default('all'),
  designRoomIds: z.array(z.string().min(1).max(4000)).max(40).default([]),
  designStructureIds: z.array(z.string().min(1).max(128)).max(40).default([]),
  designZoneId: z.string().max(128).default(''),
}).superRefine((value, ctx) => {
  if (new Set(value.interiorRoomIds).size !== value.interiorRoomIds.length)
    ctx.addIssue({ code: 'custom', path: ['interiorRoomIds'], message: 'No repitas estancias.' });
  if (new Set(value.views).size !== value.views.length) ctx.addIssue({ code: 'custom', path: ['views'], message: 'No repitas vistas.' });
  if (value.freedom !== 'strict' && value.placement === 'selected' && !value.regions.length)
    ctx.addIssue({ code: 'custom', path: ['regions'], message: 'Marca al menos una zona permitida en el plano.' });
  if (new Set(value.designRoomIds).size !== value.designRoomIds.length)
    ctx.addIssue({ code: 'custom', path: ['designRoomIds'], message: 'No repitas estancias de diseño.' });
  if (value.designScope === 'rooms' && !value.designRoomIds.length)
    ctx.addIssue({ code: 'custom', path: ['designRoomIds'], message: 'Marca al menos una estancia para diseñar.' });
  if (value.designScope === 'zone' && !value.designZoneId)
    ctx.addIssue({ code: 'custom', path: ['designZoneId'], message: 'Elige una zona de diseño.' });
  if (new Set(value.designStructureIds).size !== value.designStructureIds.length)
    ctx.addIssue({ code: 'custom', path: ['designStructureIds'], message: 'No repitas elementos del diseño.' });
});
export type RenderDesignOptions = z.infer<typeof renderDesignOptionsSchema>;
export type RenderViewChoice = RenderDesignOptions['views'][number];
export const defaultRenderDesignOptions = (): RenderDesignOptions => ({ lighting: 'daylight', freedom: 'strict', additions: [], placement: 'all', regions: [], views: ['current'], interiorRoomIds: [], designScope: 'all', designRoomIds: [], designStructureIds: [], designZoneId: '' });

/** ¿Se generan vistas interiores por estancia en vez de los ángulos genéricos? */
export const isInteriorRenderMode = (options: RenderDesignOptions): boolean =>
  options.interiorRoomIds.length > 0;

/** Las zonas seleccionadas requieren una máscara tomada desde la misma cámara. */
export const zoneCompositeActive = (options: RenderDesignOptions): boolean =>
  options.freedom !== 'strict' && options.placement === 'selected' && options.regions.length > 0;

/** Tope de generaciones de un lote. */
export const MAX_RENDER_PASSES = 24;

/** Una imagen independiente por vista; la máscara se adjunta a esa generación. */
export const renderPassCount = (options: RenderDesignOptions): number =>
  renderItemCount(options);

/** Cuántas imágenes produce el lote: una por estancia elegida, o una por ángulo. */
export const renderItemCount = (options: RenderDesignOptions): number =>
  isInteriorRenderMode(options) ? options.interiorRoomIds.length : options.views.length;

export interface RenderGeneratedResult {
  id?: string;
  assetUrl: string;
  generation?: { provider: string; model: string; fallbackIndex: number };
}
