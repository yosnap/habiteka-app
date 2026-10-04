import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { CanvasZone, ImageAdapter, ImageResult, InpaintRequest } from '@/lib/contracts';
import { protectedInpaint } from '@/server/ai/image/protected-inpaint';
import { imageEditMask } from '@/server/ai/image/image-edit-mask';

const width = 1200, height = 800;
const cost = { amountUsd: .15, unit: 'image' as const };
const zone: CanvasZone = { id: 'detail', bbox: { x: .45, y: .42, width: .05, height: .1 } };
const decode = (base64: string) => sharp(Buffer.from(base64, 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const png = (data: Buffer, w: number, h: number) => sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();

async function fixture() {
  const original = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const x = i % width, y = Math.floor(i / width);
    original.set([x % 256, y % 256, (x * 31 + y * 7) % 256, 255], i * 4);
  }
  let candidate: Buffer;
  const inpaint = vi.fn<(request: InpaintRequest) => Promise<ImageResult>>(async req => {
    const { info } = await decode(req.baseImage.base64!);
    candidate = Buffer.alloc(info.width * info.height * 4);
    for (let i = 0; i < info.width * info.height; i++) {
      const x = i % info.width, y = Math.floor(i / info.width);
      // Patrón relativo al recorte: detecta desplazamientos al pegarlo al original.
      candidate.set([255 - x % 256, 255 - y % 256, (x + y * 3) % 256, 255], i * 4);
    }
    return { cost, assetUrl: `data:image/png;base64,${(await png(candidate, info.width, info.height)).toString('base64')}` };
  });
  const image: ImageAdapter = { generate: vi.fn(), inpaint };
  return { original, inpaint, image, candidate: () => candidate,
    baseImage: { base64: (await png(original, width, height)).toString('base64'), mimeType: 'image/png' } };
}

describe('retoque de detalles con contexto cercano', () => {
  it.each<CanvasZone>([
    zone,
    { id: 'top-left', bbox: { x: 0, y: 0, width: .05, height: .1 } },
    { id: 'bottom-right', bbox: { x: .95, y: .9, width: .05, height: .1 } },
    { id: 'L', polygon: [{ x: .451, y: .423 }, { x: .506, y: .423 }, { x: .506, y: .477 },
      { x: .479, y: .477 }, { x: .479, y: .527 }, { x: .451, y: .527 }] },
  ])('recorta referencia y máscara juntas y pega únicamente la selección en sus coordenadas originales: $id', async selection => {
    const f = await fixture();
    const result = await protectedInpaint(f.image, { baseImage: f.baseImage, zone: selection, prompt: 'En esta pared falta una puerta' });
    const crop = result.regionEdit!.contextCrop!;
    expect(crop.width).toBeLessThan(width);
    expect(crop.height).toBeLessThan(height);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(width);
    expect(crop.y + crop.height).toBeLessThanOrEqual(height);
    const sent = f.inpaint.mock.calls[0]![0];
    const reference = await decode(sent.baseImage.base64!);
    const mask = await sharp(Buffer.from(sent.editMask!.base64, 'base64')).greyscale().raw().toBuffer();
    expect(reference.info).toMatchObject({ width: crop.width, height: crop.height });
    const extract = { left: crop.x, top: crop.y, width: crop.width, height: crop.height };
    const expectedReference = await sharp(f.original, { raw: { width, height, channels: 4 } }).extract(extract).raw().toBuffer();
    expect(reference.data.equals(expectedReference)).toBe(true);
    const fullMask = imageEditMask(selection, width, height);
    const expectedMask = await sharp(fullMask, { raw: { width, height, channels: 1 } }).extract(extract).greyscale().raw().toBuffer();
    expect(mask.equals(expectedMask)).toBe(true);
    expect(imageEditMask(sent.zone, crop.width, crop.height).equals(mask)).toBe(true);
    const output = await decode(result.assetUrl.split(',')[1]!);
    expect(output.info).toMatchObject({ width, height });
    const expected = Buffer.from(f.original);
    let selected = 0;
    for (let i = 0; i < fullMask.length; i++) {
      if (fullMask[i] !== 255) continue;
      const local = ((Math.floor(i / width) - crop.y) * crop.width + i % width - crop.x) * 4;
      f.candidate().copy(expected, i * 4, local, local + 4);
      selected++;
    }
    expect(output.data.equals(expected)).toBe(true);
    expect(result.regionEdit).toMatchObject({ zone: selection, protectedPixels: width * height - selected, totalPixels: width * height });
    expect(sent.prompt).toContain('a close crop from the original image');
    expect(f.inpaint).toHaveBeenCalledTimes(1);
    expect(f.image.generate).not.toHaveBeenCalled();
  });

  it('una selección amplia conserva la vista completa y no convierte el encuadre en un cuadrado', async () => {
    const f = await fixture();
    const result = await protectedInpaint(f.image, { baseImage: f.baseImage, zone: { id: 'wide', bbox: { x: .1, y: .1, width: .8, height: .3 } }, prompt: 'Cambia el suelo' });
    expect(result.regionEdit?.contextCrop).toBeUndefined();
    const sent = f.inpaint.mock.calls[0]![0];
    expect((await decode(sent.baseImage.base64!)).info).toMatchObject({ width, height });
  });

  it('rechaza una candidata con la proporción de la planta completa cuando se solicitó un recorte cuadrado', async () => {
    const f = await fixture();
    f.inpaint.mockResolvedValue({ cost, assetUrl: `data:image/png;base64,${f.baseImage.base64}` });
    await expect(protectedInpaint(f.image, { baseImage: f.baseImage, zone, prompt: 'Añade la puerta' })).rejects.toThrow('proporción');
    expect(f.inpaint).toHaveBeenCalledTimes(1);
  });

  it('adapta la resolución del recorte generado sin alterar ni desplazar el exterior', async () => {
    const f = await fixture();
    const white = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#fff' } }).png().toBuffer();
    f.inpaint.mockResolvedValue({ cost, assetUrl: `data:image/png;base64,${white.toString('base64')}` });
    const result = await protectedInpaint(f.image, { baseImage: f.baseImage, zone, prompt: 'Cambio' });
    const mask = imageEditMask(zone, width, height), expected = Buffer.from(f.original);
    for (let i = 0; i < mask.length; i++) if (mask[i] === 255) expected.fill(255, i * 4, i * 4 + 4);
    const output = await decode(result.assetUrl.split(',')[1]!);
    expect(output.info).toMatchObject({ width, height });
    expect(output.data.equals(expected)).toBe(true);
  });
});
