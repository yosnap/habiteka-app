import { z } from 'zod';
import type { Estilo } from '@/lib/contracts';
import { ESTILOS } from '@/lib/design-options';
import { DESIGN_SPACE_KINDS } from '@/lib/design-space-kind';
import { renderDesignOptionsSchema, type RenderDesignOptions } from './render-design-options';

export const renderPresetSchema = z.object({
  name: z.string().trim().min(1).max(60),
  style: z.enum(ESTILOS.map((item) => item.value) as [Estilo, ...Estilo[]]),
  objective: z.string().max(200), instruction: z.string().max(500),
  intent: z.enum(['image', 'editable']), options: renderDesignOptionsSchema,
  spaceKind: z.enum(DESIGN_SPACE_KINDS.map((item) => item.value) as [typeof DESIGN_SPACE_KINDS[number]['value'], ...typeof DESIGN_SPACE_KINDS[number]['value'][]]).optional(),
});
export type RenderDesignPreset = z.infer<typeof renderPresetSchema>;

/** Solo ajustes transferibles: las estancias, zonas y cámaras se eligen en cada inmueble. */
export function transferableRenderOptions(options: RenderDesignOptions): RenderDesignOptions {
  return renderDesignOptionsSchema.parse({ ...options, placement: 'all', regions: [], interiorRoomIds: [],
    designRoomIds: [], designStructureIds: [], designZoneId: '',
    designScope: options.designScope === 'rooms' || options.designScope === 'zone' ? 'all' : options.designScope });
}

export function readRenderPresets(raw: string | null): RenderDesignPreset[] {
  try {
    const values: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(values)) return [];
    return values.slice(0, 10).flatMap((value) => {
      const parsed = renderPresetSchema.safeParse(value);
      return parsed.success ? [{ ...parsed.data, options: transferableRenderOptions(parsed.data.options) }] : [];
    });
  } catch { return []; }
}
