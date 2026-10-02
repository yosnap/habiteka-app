import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { sanitizeImageBuffer, sanitizeOwnRenderBuffer, rejectExternalImageUrl } from '@/server/ai/image/input-sanitizer';

// Genera imágenes reales con sharp para ejercer los bytes mágicos y dimensiones.
async function pngBuffer(size: number): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
}

describe('input-sanitizer (anti-SSRF / decompression-bomb)', () => {
  it('acepta una imagen válida y la re-codifica a PNG con dimensiones', async () => {
    const buf = await pngBuffer(64);
    const out = await sanitizeImageBuffer(buf);
    expect(out.mimeType).toBe('image/png');
    expect(out.width).toBe(64);
    expect(out.height).toBe(64);
    expect(out.base64.length).toBeGreaterThan(0);
  });

  it('rechaza un buffer cuyos bytes mágicos no son de imagen', async () => {
    const notImage = Buffer.from('esto no es una imagen', 'utf8');
    await expect(sanitizeImageBuffer(notImage)).rejects.toMatchObject({ kind: 'sanitizer' });
  });

  it('rechaza dimensiones por encima del máximo (anti-bomb)', async () => {
    const huge = await pngBuffer(2049); // sobre MAX_IMAGE_DIMENSION (2048)
    await expect(sanitizeImageBuffer(huge)).rejects.toMatchObject({ kind: 'call_limit' });
  });

  it('prohíbe URLs de imagen externas del usuario', () => {
    expect(() => rejectExternalImageUrl()).toThrowError(/externas/);
  });

  it('reduce un resultado propio que excede 10 MB antes de auditarlo', async () => {
    const original = await sharp(randomBytes(1900 * 1900 * 3), {
      raw: { width: 1900, height: 1900, channels: 3 },
    }).png().toBuffer();
    expect(original.byteLength).toBeGreaterThan(10 * 1024 * 1024);
    await expect(sanitizeImageBuffer(original)).rejects.toMatchObject({ kind: 'call_limit' });
    const sanitized = await sanitizeOwnRenderBuffer(original);
    const result = Buffer.from(sanitized.base64, 'base64');
    expect(result.byteLength).toBeLessThanOrEqual(10 * 1024 * 1024);
    expect(sanitized.width).toBeLessThan(1900);
  });
});
