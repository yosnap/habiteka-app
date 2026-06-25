import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  blurRegions,
  blurFaces,
  type FaceDetector,
  type FaceBox,
} from '@/server/privacy/face-blur';
import { scrubImageForAi, FaceBlurUnavailableError } from '@/server/privacy/pii-scrub';

// Imagen de prueba: ruido determinista para que el blur cambie los píxeles.
async function noiseImage(width = 64, height = 64): Promise<Buffer> {
  const px = Buffer.alloc(width * height * 3);
  for (let i = 0; i < px.length; i++) px[i] = (i * 37) % 256;
  return sharp(px, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

function detectorReturning(boxes: FaceBox[]): FaceDetector {
  return { detect: async () => boxes };
}

describe('blurRegions', () => {
  it('difumina la región indicada (los píxeles cambian respecto al original)', async () => {
    const img = await noiseImage();
    const out = await blurRegions(img, [[10, 10, 20, 20]]);

    const original = await sharp(img)
      .extract({ left: 10, top: 10, width: 20, height: 20 })
      .raw()
      .toBuffer();
    const blurred = await sharp(out)
      .extract({ left: 10, top: 10, width: 20, height: 20 })
      .raw()
      .toBuffer();
    expect(Buffer.compare(original, blurred)).not.toBe(0);
  });

  it('recorta cajas fuera de los límites sin romper', async () => {
    const img = await noiseImage(32, 32);
    const out = await blurRegions(img, [[20, 20, 100, 100]]);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(32);
  });

  it('sin cajas, devuelve un PNG válido del mismo tamaño', async () => {
    const img = await noiseImage(48, 48);
    const out = await blurRegions(img, []);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(48);
  });
});

describe('blurFaces', () => {
  it('usa las cajas del detector inyectado', async () => {
    const img = await noiseImage();
    const out = await blurFaces(detectorReturning([[5, 5, 10, 10]]), img);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('png');
  });
});

describe('scrubImageForAi', () => {
  it('con detector: difumina y luego sanea (PNG sin EXIF)', async () => {
    const img = await noiseImage();
    const result = await scrubImageForAi(img, { detector: detectorReturning([[5, 5, 10, 10]]) });
    expect(result.mimeType).toBe('image/png');
    expect(result.base64.length).toBeGreaterThan(0);
  });

  it('sin detector y política continue: sanea igualmente (EXIF fuera)', async () => {
    const img = await noiseImage();
    const result = await scrubImageForAi(img, { onNoDetector: 'continue' });
    expect(result.mimeType).toBe('image/png');
  });

  it('sin detector y política reject: lanza FaceBlurUnavailableError', async () => {
    const img = await noiseImage();
    await expect(scrubImageForAi(img, { onNoDetector: 'reject' })).rejects.toBeInstanceOf(
      FaceBlurUnavailableError,
    );
  });
});
