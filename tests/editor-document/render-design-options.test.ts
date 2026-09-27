import { describe, expect, it } from 'vitest';
import { defaultRenderDesignOptions, renderDesignOptionsSchema } from '@/lib/editor-document/render-design-options';

describe('permisos de diseño IA', () => {
  it('no autoriza adiciones por defecto', () => {
    expect(renderDesignOptionsSchema.parse({})).toEqual(defaultRenderDesignOptions());
  });
  it('exige una zona al restringir decoración al área seleccionada', () => {
    expect(renderDesignOptionsSchema.safeParse({ freedom: 'controlled', placement: 'selected', additions: ['plants'] }).success).toBe(false);
  });
  it('rechaza vistas duplicadas e iluminación desconocida', () => {
    expect(renderDesignOptionsSchema.safeParse({ views: ['top', 'top'] }).success).toBe(false);
    expect(renderDesignOptionsSchema.safeParse({ lighting: 'arbitrary' }).success).toBe(false);
    expect(renderDesignOptionsSchema.safeParse({ designScope: 'rooms' }).success).toBe(false);
  });
  it('mantiene los polígonos en coordenadas reales del documento', () => {
    const regions = [{ id: 'center', name: 'Centro del patio', polygon: [{ x: 8000, y: 1000 }, { x: 12000, y: 1000 }, { x: 12000, y: 6000 }, { x: 8000, y: 6000 }] }];
    const value = renderDesignOptionsSchema.parse({ freedom: 'controlled', additions: ['plants', 'lights'], placement: 'selected', regions, views: ['front', 'drone'], lighting: 'warm' });
    expect(value.regions).toEqual(regions);
    expect(value.views).toEqual(['front', 'drone']);
  });
});
