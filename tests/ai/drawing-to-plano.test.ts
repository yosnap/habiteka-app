import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { drawingToPlano } from '@/server/plan/drawing-to-plano';

describe('dibujo sin reinterpretación generativa', () => {
  it('un rectángulo sigue siendo cuatro muros sin vanos ni medidas inventadas', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="white"/><path d="M140 120H700V450H140Z" fill="none" stroke="black" stroke-width="7"/></svg>';
    const result = await drawingToPlano(await sharp(Buffer.from(svg)).png().toBuffer());
    expect(result.escalaEstimada).toBe(true);
    expect(result.plano.zones.flatMap((z) => z.walls)).toHaveLength(4);
    expect(result.plano.zones.flatMap((z) => z.apertures)).toHaveLength(0);
  });
  it('rechaza una imagen vacía', async () => {
    const blank = await sharp({
      create: { width: 900, height: 600, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    await expect(drawingToPlano(blank)).rejects.toThrow('al menos dos muros');
  });
});
