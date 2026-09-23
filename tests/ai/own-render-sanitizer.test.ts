/**
 * Un render propio más grande que el máximo (los modelos devuelven >2048 px) se
 * reutiliza como referencia de estilo reducido, no rechazado. Una subida de usuario
 * del mismo tamaño se sigue rechazando.
 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { sanitizeImageBuffer, sanitizeOwnRenderBuffer } from '@/server/ai/image/input-sanitizer';

const big = () =>
  sharp({ create: { width: 3072, height: 2048, channels: 3, background: { r: 200, g: 190, b: 180 } } }).png().toBuffer();

describe('saneado de renders propios', () => {
  it('reduce un render propio que supera el máximo manteniendo la proporción', async () => {
    const out = await sanitizeOwnRenderBuffer(await big());
    const meta = await sharp(Buffer.from(out.base64, 'base64')).metadata();
    expect(meta.width).toBe(2048);
    expect(meta.height).toBe(1365);
    expect(out.mimeType).toBe('image/png');
  });

  it('una subida de usuario del mismo tamaño se sigue rechazando', async () => {
    await expect(sanitizeImageBuffer(await big())).rejects.toThrow('máximo de dimensiones');
  });
});
