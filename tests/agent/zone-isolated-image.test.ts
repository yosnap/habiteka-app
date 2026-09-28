import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { isolateZoneReference, isolateZoneResult } from '@/server/agent/editor-v2/zone-isolated-image';

const W = 40, H = 20;
const image = async (data: Buffer, channels: 1 | 3) => ({
  base64: (await sharp(data, { raw: { width: W, height: H, channels } }).png().toBuffer()).toString('base64'),
  mimeType: 'image/png' as const, width: W, height: H,
});
const rgbaMask = async (grey: Buffer) => {
  const rgba = Buffer.alloc(W * H * 4);
  for (let pixel = 0; pixel < W * H; pixel++) {
    rgba.fill(grey[pixel]!, pixel * 4, pixel * 4 + 3);
    rgba[pixel * 4 + 3] = 255;
  }
  return { base64: (await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()).toString('base64'),
    mimeType: 'image/png' as const, width: W, height: H };
};

describe('aislamiento de imágenes por zona', () => {
  it('blanquea lo ajeno, acerca el encuadre y conserva la máscara alineada', async () => {
    const source = Buffer.alloc(W * H * 3, 40);
    const area = Buffer.alloc(W * H);
    for (let y = 5; y <= 15; y++) for (let x = 10; x <= 20; x++) area[y * W + x] = 255;
    const isolated = await isolateZoneReference(await image(source, 3), await rgbaMask(area));
    expect(isolated.image.width).toBeLessThan(W);
    expect(isolated.image.height).toBe(H);
    expect(isolated.mask.width).toBe(isolated.image.width);
    const { data: pixels, info } = await sharp(Buffer.from(isolated.image.base64, 'base64')).raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => pixels[(y * info.width + x) * info.channels];
    expect(at(0, 0)).toBe(236);
    expect(at(12, 10)).toBe(40);
    const generated = await isolateZoneResult({ ...isolated.image,
      base64: (await sharp({ create: { width: isolated.image.width, height: isolated.image.height,
        channels: 3, background: '#991122' } }).png().toBuffer()).toString('base64') }, isolated.mask);
    const { data: output, info: outInfo } = await sharp(generated).raw().toBuffer({ resolveWithObject: true });
    expect(output[0]).toBe(236);
    expect(output[(10 * outInfo.width + 12) * outInfo.channels]).toBe(153);
  });

  it('rechaza máscaras de otra cámara y resultados con proporción distinta', async () => {
    const source = await image(Buffer.alloc(W * H * 3, 80), 3);
    const mask = await image(Buffer.alloc(W * H, 255), 1);
    await expect(isolateZoneReference(source, { ...mask, width: W - 1 })).rejects.toThrow('no coincide');
    await expect(isolateZoneResult({ ...source, width: W / 2 }, mask)).rejects.toThrow('proporción');
  });
});
