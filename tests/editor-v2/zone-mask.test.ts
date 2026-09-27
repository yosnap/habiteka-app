import { describe, expect, it } from 'vitest';
import { zoneMapLayout, ZONE_MASK_MARGIN_MM } from '../../src/components/editor-v2/scene/zone-mask';
import { defaultRenderDesignOptions, zoneCompositeActive } from '../../src/lib/editor-document/render-design-options';

describe('máscara de zonas permitidas', () => {
  it('cubre todas las zonas con el margen de muro', () => {
    const layout = zoneMapLayout([
      [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }],
      [{ x: 5000, y: 1000 }, { x: 6000, y: 1000 }, { x: 6000, y: 2000 }],
    ]);
    expect(layout).toEqual({ minX: -ZONE_MASK_MARGIN_MM, minY: -ZONE_MASK_MARGIN_MM,
      width: 6000 + 2 * ZONE_MASK_MARGIN_MM, height: 3000 + 2 * ZONE_MASK_MARGIN_MM });
  });
  it('sin zonas no hay máscara', () => expect(zoneMapLayout([])).toBeNull());
  it('requiere máscara cuando se diseña dentro de zonas marcadas', () => {
    const region = { id: 'r', name: 'Salón', polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] };
    const base = { ...defaultRenderDesignOptions(), placement: 'selected' as const, regions: [region] };
    expect(zoneCompositeActive({ ...base, freedom: 'free' })).toBe(true);
    expect(zoneCompositeActive({ ...base, freedom: 'strict' })).toBe(false);
    expect(zoneCompositeActive({ ...base, freedom: 'free', placement: 'all' })).toBe(false);
  });
});

describe('generaciones que cuesta un lote', () => {
  it('cuenta una imagen independiente por vista también con zonas', async () => {
    const { renderPassCount } = await import('../../src/lib/editor-document/render-design-options');
    const region = { id: 'r', name: 'Salón', polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] };
    const views = ['front', 'right', 'drone'] as ('front' | 'right' | 'drone')[];
    expect(renderPassCount({ ...defaultRenderDesignOptions(), views })).toBe(3);
    expect(renderPassCount({ ...defaultRenderDesignOptions(), views, freedom: 'free', placement: 'selected', regions: [region] })).toBe(3);
  });
});
