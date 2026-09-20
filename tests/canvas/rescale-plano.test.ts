/**
 * Reescalado del plano al ancho real aportado por el usuario: coordenadas,
 * anchos de abertura y ETIQUETAS de cota deben recalcularse con el dato nuevo.
 */
import { describe, expect, it } from 'vitest';
import { rescalePlanoToWidth } from '@/lib/plan-svg/rescale-plano';
import type { Plano2dPayload } from '@/lib/contracts';

function plano(): Plano2dPayload {
  return {
    schemaVersion: 1,
    zones: [
      {
        id: 'z0',
        name: 'Estancia',
        outline: [
          { x: 0, y: 0 },
          { x: 5000, y: 0 },
          { x: 5000, y: 4000 },
          { x: 0, y: 4000 },
        ],
        walls: [{ id: 'w0', from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thicknessMm: 120 }],
        apertures: [{ id: 'a0', kind: 'puerta', wallId: 'w0', position: 0.5, widthMm: 900 }],
        dimensions: [
          { id: 'd0', from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, label: '5.00 m' },
        ],
      },
    ],
  };
}

describe('rescalePlanoToWidth', () => {
  it('reescala coordenadas, aberturas y regenera las etiquetas de cota', () => {
    const out = rescalePlanoToWidth(plano(), 10); // 5 m → 10 m (factor 2)
    const zone = out.zones[0]!;
    expect(zone.walls[0]!.to.x).toBe(10000);
    expect(zone.outline[2]).toEqual({ x: 10000, y: 8000 });
    expect(zone.apertures[0]!.widthMm).toBe(1800);
    expect(zone.dimensions[0]!.label).toBe('10.00 m');
    expect(zone.dimensions[0]!.to.x).toBe(10000);
  });

  it('con entrada inválida o plano sin muros devuelve el plano intacto', () => {
    expect(rescalePlanoToWidth(plano(), 0)).toEqual(plano());
    expect(rescalePlanoToWidth(plano(), NaN)).toEqual(plano());
    const empty: Plano2dPayload = { schemaVersion: 1, zones: [] };
    expect(rescalePlanoToWidth(empty, 10)).toEqual(empty);
  });
});
