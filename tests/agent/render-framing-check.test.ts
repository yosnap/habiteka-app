import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { assertRenderFraming } from '@/server/agent/editor-v2/render-framing-check';

async function image(left: number, top: number, width: number, height: number) {
  const svg = `<svg width="400" height="200"><rect x="${left}" y="${top}" width="${width}" height="${height}" fill="#384350"/></svg>`;
  const bytes = await sharp({ create: { width: 400, height: 200, channels: 3,
    background: '#f4f4f2' } }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  return { base64: bytes.toString('base64'), mimeType: 'image/png' };
}

describe('encuadre del render', () => {
  it('acepta el mismo inmueble y pequeñas variaciones de encuadre', async () => {
    const original = await image(140, 60, 120, 80);
    const edit = await image(136, 58, 126, 82);
    await expect(assertRenderFraming(original, edit)).resolves.toBeUndefined();
  });

  it('acepta un acercamiento que mantiene completa la escena', async () => {
    await expect(assertRenderFraming(await image(140, 60, 120, 80), await image(90, 35, 220, 130)))
      .resolves.toBeUndefined();
  });

  it('rechaza una ampliación extrema dentro de la misma cámara', async () => {
    await expect(assertRenderFraming(await image(140, 60, 120, 80), await image(45, 5, 300, 190)))
      .rejects.toThrow('recortó o desplazó');
  });

  it('rechaza desplazar el inmueble fuera de su posición original', async () => {
    await expect(assertRenderFraming(await image(100, 60, 120, 80), await image(205, 60, 120, 80)))
      .rejects.toThrow('recortó o desplazó');
  });
});
