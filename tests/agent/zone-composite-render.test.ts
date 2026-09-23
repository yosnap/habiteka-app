import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('server-only', () => ({}));
const stored = new Map<string, Buffer>();
vi.mock('@/server/storage/s3-storage-adapter', () => ({
  getStorageAdapter: () => ({
    put: async ({ key, body }: { key: string; body: Buffer }) => { stored.set(key, body); },
    get: async (key: string) => stored.get(key)!,
    getPresignedDownloadUrl: async (key: string) => `https://storage.test/${key}`,
  }),
}));

const { compositeZoneImages, generateZoneCompositeRender, zoneMaskCoverage } =
  await import('../../src/server/agent/editor-v2/zone-composite-render');

const W = 200, H = 100;
const solid = (r: number, g: number, b: number) =>
  sharp({ create: { width: W, height: H, channels: 3, background: { r, g, b } } }).png().toBuffer();
/** Máscara con la mitad izquierda blanca. */
const halfMask = () => sharp({ create: { width: W, height: H, channels: 3, background: '#000' } })
  .composite([{ input: { create: { width: W / 2, height: H, channels: 3, background: '#fff' } }, left: 0, top: 0 }])
  .png().toBuffer();
const pixel = async (image: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (y * info.width + x) * 3;
  return [data[at]!, data[at + 1]!, data[at + 2]!];
};

describe('composición de zonas permitidas', () => {
  it('mide qué parte de la imagen ocupa la zona', async () => {
    expect(await zoneMaskCoverage(await halfMask())).toBeCloseTo(0.5, 2);
    expect(await zoneMaskCoverage(await solid(0, 0, 0))).toBe(0);
  });

  it('pone el diseño dentro de la zona y deja la base intacta lejos del borde', async () => {
    const out = await compositeZoneImages(await solid(255, 0, 0), await solid(0, 0, 255), await halfMask());
    const inside = await pixel(out, 10, 50), outside = await pixel(out, 190, 50);
    expect(inside[2]).toBeGreaterThan(240); expect(inside[0]).toBeLessThan(15);
    expect(outside[0]).toBeGreaterThan(240); expect(outside[2]).toBeLessThan(15);
  });

  it('ajusta base y máscara al tamaño del diseño', async () => {
    const design = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#00f' } }).png().toBuffer();
    const out = await compositeZoneImages(await solid(255, 0, 0), design, await halfMask());
    expect(await sharp(out).metadata()).toMatchObject({ width: 400, height: 200 });
  });
});

describe('pasadas de render con zonas', () => {
  const adapter = (colors: Record<string, Buffer>) => {
    const generate = vi.fn(async (request: { prompt: string }) => {
      const key = `renders/test/${request.prompt}.png`;
      stored.set(key, colors[request.prompt]!);
      return { assetUrl: `https://storage.test/${key}`, assetKey: key, cost: { usd: 0.08 },
        generation: { provider: 'kie', model: request.prompt, fallbackIndex: 0 } };
    });
    return { generate, inpaint: vi.fn() } as never as { generate: typeof generate };
  };

  it('con la zona fuera de cuadro solo paga la pasada base', async () => {
    const image = adapter({ base: await solid(255, 0, 0) });
    const result = await generateZoneCompositeRender({ image: image as never, mask: await solid(0, 0, 0),
      base: { prompt: 'base' }, design: { prompt: 'design' } });
    expect(image.generate).toHaveBeenCalledTimes(1);
    expect(result.zoneComposite.mode).toBe('base_only');
  });

  it('con la zona en toda la imagen solo paga la pasada de diseño', async () => {
    const image = adapter({ design: await solid(0, 0, 255) });
    const result = await generateZoneCompositeRender({ image: image as never, mask: await solid(255, 255, 255),
      base: { prompt: 'base' }, design: { prompt: 'design' } });
    expect(image.generate).toHaveBeenCalledTimes(1);
    expect(result.zoneComposite.mode).toBe('design_only');
  });

  it('con zona parcial genera las dos y guarda la composición', async () => {
    const image = adapter({ base: await solid(255, 0, 0), design: await solid(0, 0, 255) });
    const result = await generateZoneCompositeRender({ image: image as never, mask: await halfMask(),
      base: { prompt: 'base' }, design: { prompt: 'design' } });
    expect(image.generate).toHaveBeenCalledTimes(2);
    expect(result.zoneComposite).toMatchObject({ mode: 'two_pass' });
    expect(result.assetKey).toMatch(/^renders\/zones\/.+\.jpg$/);
    const composed = stored.get(result.assetKey!)!;
    expect((await pixel(composed, 10, 50))[2]).toBeGreaterThan(240);
    expect((await pixel(composed, 190, 50))[0]).toBeGreaterThan(240);
    expect(result.generation?.model).toBe('design');
  });
});
