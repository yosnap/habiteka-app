import { describe, expect, it } from 'vitest';
import type { PlanAperture, Plano2dPayload } from '@/lib/contracts';
import { cleanupApertures } from '@/server/ai/sketch/aperture-cleanup';

function plano(apertures: PlanAperture[], lengthMm = 3000): Plano2dPayload {
  return {
    schemaVersion: 1,
    zones: [{
      id: 'z0', name: 'A', outline: [], dimensions: [],
      walls: [{ id: 'w0', from: { x: 0, y: 0 }, to: { x: lengthMm, y: 0 }, thicknessMm: 100 }],
      apertures,
    }],
  };
}

describe('cleanupApertures', () => {
  it('conserva aberturas separadas y las ordena por posición', () => {
    const out = cleanupApertures(plano([
      { id: 'a1', kind: 'ventana', wallId: 'w0', position: 0.8, widthMm: 1000 },
      { id: 'a0', kind: 'puerta', wallId: 'w0', position: 0.2, widthMm: 900 },
    ]));
    expect(out.zones[0]!.apertures.map((a) => a.id)).toEqual(['a0', 'a1']);
  });

  it('ante un solape conserva la más ancha', () => {
    const out = cleanupApertures(plano([
      { id: 'door', kind: 'puerta', wallId: 'w0', position: 0.5, widthMm: 900 },
      { id: 'gap', kind: 'hueco', wallId: 'w0', position: 0.6, widthMm: 600 },
    ]));
    expect(out.zones[0]!.apertures.map((a) => a.id)).toEqual(['door']);
  });

  it('recentra una abertura que asoma por el extremo y descarta la que no cabe', () => {
    const out = cleanupApertures(plano([
      { id: 'edge', kind: 'puerta', wallId: 'w0', position: 0.02, widthMm: 900 },
      { id: 'huge', kind: 'ventana', wallId: 'w0', position: 0.5, widthMm: 4000 },
    ]));
    expect(out.zones[0]!.apertures).toHaveLength(1);
    expect(out.zones[0]!.apertures[0]!.position).toBeCloseTo(0.15, 5);
  });
});
