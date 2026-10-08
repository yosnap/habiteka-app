import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { CanvasZone, ImageAdapter, ImageResult, InpaintRequest } from '@/lib/contracts';
import type { StorageAdapter } from '@/server/storage/storage-adapter';
import { protectedInpaint } from '@/server/ai/image/protected-inpaint';

const width = 24, height = 16;
const zone: CanvasZone = { id: 'detail', bbox: { x: .25, y: .25, width: .5, height: .5 } };
const cost = { amountUsd: .15, unit: 'image' as const };
const png = (pixels: Buffer, w = width, h = height) => sharp(pixels, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
const dataUrl = (bytes: Buffer) => `data:image/png;base64,${bytes.toString('base64')}`;
const decode = (url: string) => sharp(Buffer.from(url.split(',')[1]!, 'base64')).ensureAlpha().raw().toBuffer();

async function fixture() {
  // Patrón distinto en cada píxel, con canal alfa: comprueba conservación real.
  const original = Buffer.from(Array.from({ length: width * height * 4 }, (_, i) => (i * 17 + 11) % 256));
  const baseImage = { base64: (await png(original)).toString('base64'), mimeType: 'image/png' };
  const changed = Buffer.alloc(width * height * 4, 255);
  const inpaint = vi.fn<(request: InpaintRequest) => Promise<ImageResult>>(async () => ({ assetUrl: dataUrl(await png(changed)), cost }));
  const image: ImageAdapter = { generate: vi.fn(), inpaint };
  return { original, changed, baseImage, inpaint, image };
}

describe('retoque con protección exterior', () => {
  it('conserva todos los píxeles exteriores aunque el modelo cambie la imagen entera', async () => {
    const f = await fixture();
    const result = await protectedInpaint(f.image, { baseImage: f.baseImage, zone, prompt: 'Quita la hoja' });
    const output = await decode(result.assetUrl);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const expected = x >= 6 && x < 18 && y >= 4 && y < 12 ? f.changed : f.original;
      expect(output.subarray(offset, offset + 4)).toEqual(expected.subarray(offset, offset + 4));
    }
    expect(result.regionEdit).toMatchObject({ mode: 'original-pixels-v1', protectedPixels: 288, totalPixels: 384 });
    expect(f.inpaint).toHaveBeenCalledTimes(1);
    expect(f.image.generate).not.toHaveBeenCalled();
    const request = f.inpaint.mock.calls[0]![0];
    const mask = await sharp(Buffer.from(request.editMask!.base64, 'base64')).greyscale().raw().toBuffer();
    expect([...mask].filter(value => value === 255)).toHaveLength(96);
    expect(request.prompt).toContain('complete original image');
  });

  it('respeta un polígono cóncavo sin sustituirlo por su caja delimitadora', async () => {
    const f = await fixture();
    const polygon = [{ x: .25, y: .25 }, { x: .75, y: .25 }, { x: .75, y: .5 },
      { x: .5, y: .5 }, { x: .5, y: .75 }, { x: .25, y: .75 }];
    const result = await protectedInpaint(f.image, { baseImage: f.baseImage, zone: { id: 'L', polygon }, prompt: 'Cambia solo el suelo' });
    const output = await decode(result.assetUrl);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const inside = (x >= 6 && x < 18 && y >= 4 && y < 8) || (x >= 6 && x < 12 && y >= 8 && y < 12);
      expect(output.subarray(offset, offset + 4)).toEqual((inside ? f.changed : f.original).subarray(offset, offset + 4));
    }
    expect(result.regionEdit?.protectedPixels).toBe(312);
  });

  it.each([
    { id: 'nan', bbox: { x: NaN, y: 0, width: .2, height: .2 } },
    { id: 'large', bbox: { x: .9, y: 0, width: .2, height: .2 } },
    { id: 'tiny', bbox: { x: 0, y: 0, width: .001, height: .001 } },
    { ...zone, maskRef: 'https://external.test/mask.png' },
  ])('rechaza una máscara inválida antes de llamar al modelo: $id', async invalid => {
    const f = await fixture();
    await expect(protectedInpaint(f.image, { baseImage: f.baseImage, zone: invalid, prompt: 'Cambio' })).rejects.toThrow();
    expect(f.inpaint).not.toHaveBeenCalled();
  });

  it('rechaza una proporción diferente después de una sola llamada y sin reintentar', async () => {
    const f = await fixture();
    f.inpaint.mockResolvedValue({ assetUrl: dataUrl(await png(Buffer.alloc(16 * 16 * 4, 255), 16, 16)), cost });
    await expect(protectedInpaint(f.image, { baseImage: f.baseImage, zone, prompt: 'Cambio' })).rejects.toThrow('proporción');
    expect(f.inpaint).toHaveBeenCalledTimes(1);
  });

  it('admite otra resolución de la misma proporción y mantiene la resolución y píxeles exteriores originales', async () => {
    const f = await fixture();
    f.inpaint.mockResolvedValue({ assetUrl: dataUrl(await png(Buffer.alloc(48 * 32 * 4, 255), 48, 32)), cost });
    const result = await protectedInpaint(f.image, { baseImage: f.baseImage, zone, prompt: 'Cambio' });
    const output = await decode(result.assetUrl);
    expect(output).toHaveLength(f.original.length);
    expect(output.subarray(0, width * 4)).toEqual(f.original.subarray(0, width * 4));
  });

  it('guarda el resultado protegido, nunca devuelve la clave del candidato sin proteger', async () => {
    const f = await fixture();
    const candidate = await f.inpaint({ baseImage: f.baseImage, zone, prompt: '' });
    const inpaint = vi.fn(async () => ({ ...candidate, assetKey: 'candidate.png' }));
    const put = vi.fn();
    const storage = { get: vi.fn(async () => png(f.changed)), put, getPresignedDownloadUrl: async (key: string) => `https://own.test/${key}` } as unknown as StorageAdapter;
    const result = await protectedInpaint({ ...f.image, inpaint }, { baseImage: f.baseImage, zone, prompt: 'Cambio' }, storage);
    expect(result.assetKey).toMatch(/^renders\/edits\/.+\.png$/);
    expect(result.cost).toEqual(cost);
    const saved = await sharp(put.mock.calls[0]![0].body).ensureAlpha().raw().toBuffer();
    expect(saved.subarray(0, width * 4)).toEqual(f.original.subarray(0, width * 4));
  });

  it('no descarga URLs externas y rechaza una base no recuperable antes de gastar', async () => {
    const f = await fixture();
    await expect(protectedInpaint(f.image, { baseImage: { url: 'https://external.test/a.png' }, zone, prompt: 'Cambio' })).rejects.toThrow('imagen guardada');
    expect(f.inpaint).not.toHaveBeenCalled();
    f.inpaint.mockResolvedValue({ assetUrl: 'https://external.test/result.png', cost });
    await expect(protectedInpaint(f.image, { baseImage: f.baseImage, zone, prompt: 'Cambio' })).rejects.toThrow('almacenamiento');
    expect(f.inpaint).toHaveBeenCalledTimes(1);
  });

  it('una petición explícita para toda la imagen conserva el alcance global', async () => {
    const f = await fixture();
    const whole: CanvasZone = { id: 'global', bbox: { x: 0, y: 0, width: 1, height: 1 } };
    const result = await protectedInpaint(f.image, { baseImage: f.baseImage, zone: whole, prompt: 'Cambia el estilo' });
    expect(result.regionEdit).toBeUndefined();
    expect(f.inpaint.mock.calls[0]![0].editMask).toBeUndefined();
    expect(await decode(result.assetUrl)).toEqual(f.changed);
  });
});
