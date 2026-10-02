import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { kitchenRunDefaults } from '@/lib/editor-document/kitchen-run-types';
import { zoneCaptureRegions } from '@/lib/editor-document/zone-capture-regions';

const zone = [[{ x: 0, y: 0 }, { x: 1900, y: 0 }, { x: 1900, y: 1000 }, { x: 0, y: 1000 }]];
const kitchen = kitchenRunDefaults({ id: 'kitchen', x: 0, y: 0, widthMm: 2000, rotation: 0 });
const column = { id: 'column', catalogId: 'builtin:column-rectangular' as const,
  x: 1950, y: 0, widthMm: 300, depthMm: 300, heightMm: 3000,
  elevationMm: 0, rotation: 0, materialId: 'concrete-grey' };

describe('captura de una zona con cocina', () => {
  it('incluye el pilar que recorta la esquina visible aunque esté fuera del contorno', () => {
    const document = { ...emptyEditorDocument(), kitchenRuns: [kitchen], columns: [column] };
    const regions = zoneCaptureRegions(document, zone);
    expect(regions).toHaveLength(2);
    expect(regions[1]).toEqual([{ x: 1950, y: 0 }, { x: 2250, y: 0 },
      { x: 2250, y: 300 }, { x: 1950, y: 300 }]);
  });

  it('no trae pilares de otras estancias ni ajenos al mueble visible', () => {
    const document = { ...emptyEditorDocument(), kitchenRuns: [kitchen],
      columns: [{ ...column, x: 2500 }, { ...column, elevationMm: 2500 }] };
    expect(zoneCaptureRegions(document, zone)).toBe(zone);
  });
});
