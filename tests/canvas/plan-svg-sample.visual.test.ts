/**
 * Generador de muestra visual (temporal, no aserciones de negocio): escribe un
 * PNG del plano de ejemplo en el scratchpad para inspección manual del acabado.
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
import type { Plano2dPayload } from '@/lib/contracts';

const OUT = process.env.PLAN_SVG_SAMPLE_OUT;

const sample: Plano2dPayload = {
  schemaVersion: 1,
  zones: [
    {
      id: 'z0',
      name: 'Salón',
      outline: [
        { x: 0, y: 0 },
        { x: 4500, y: 0 },
        { x: 4500, y: 3600 },
        { x: 0, y: 3600 },
      ],
      walls: [
        { id: 'w0', from: { x: 0, y: 0 }, to: { x: 4500, y: 0 }, thicknessMm: 120 },
        { id: 'w1', from: { x: 4500, y: 0 }, to: { x: 4500, y: 3600 }, thicknessMm: 120 },
        { id: 'w2', from: { x: 4500, y: 3600 }, to: { x: 0, y: 3600 }, thicknessMm: 120 },
        { id: 'w3', from: { x: 0, y: 3600 }, to: { x: 0, y: 0 }, thicknessMm: 120 },
      ],
      apertures: [
        { id: 'a0', kind: 'ventana', wallId: 'w0', position: 0.5, widthMm: 1600 },
        { id: 'a1', kind: 'puerta', wallId: 'w2', position: 0.75, widthMm: 900 },
      ],
      dimensions: [
        { id: 'd0', from: { x: 0, y: 0 }, to: { x: 4500, y: 0 }, label: '4.50 m' },
        { id: 'd1', from: { x: 0, y: 3600 }, to: { x: 0, y: 0 }, label: '3.60 m' },
      ],
    },
    {
      id: 'z1',
      name: 'Dormitorio',
      outline: [
        { x: 4500, y: 0 },
        { x: 7500, y: 0 },
        { x: 7500, y: 3600 },
        { x: 4500, y: 3600 },
      ],
      walls: [
        { id: 'w4', from: { x: 4500, y: 0 }, to: { x: 7500, y: 0 }, thicknessMm: 120 },
        { id: 'w5', from: { x: 7500, y: 0 }, to: { x: 7500, y: 3600 }, thicknessMm: 120 },
        { id: 'w6', from: { x: 7500, y: 3600 }, to: { x: 4500, y: 3600 }, thicknessMm: 120 },
      ],
      apertures: [
        { id: 'a2', kind: 'hueco', wallId: 'w1', position: 0.5, widthMm: 900 },
        { id: 'a3', kind: 'ventana', wallId: 'w5', position: 0.5, widthMm: 1400 },
      ],
      dimensions: [{ id: 'd2', from: { x: 4500, y: 0 }, to: { x: 7500, y: 0 }, label: '3.00 m' }],
    },
  ],
};

describe.skipIf(!OUT)('muestra visual del plano SVG', () => {
  it('rasteriza el plano de ejemplo al scratchpad', async () => {
    const svg = planoToSvg(sample, { pxPerMeter: 120 });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    writeFileSync(OUT!, png);
    expect(png.length).toBeGreaterThan(0);
  });
});
