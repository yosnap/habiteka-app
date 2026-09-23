import 'server-only';
import sharp from 'sharp';
import type { ImageAdapter, ImageGenRequest, ImageResult } from '@/lib/contracts/image-adapter';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { readRenderReference } from './render-asset-reader';

/** Por debajo, la zona no se ve en esta vista; por encima, ocupa toda la imagen. */
export const ZONE_EMPTY_COVERAGE = 0.005;
export const ZONE_FULL_COVERAGE = 0.995;

export type ZoneCompositeMode = 'two_pass' | 'base_only' | 'design_only';

/** Fracción de la imagen que ocupa la zona permitida (0–1). */
export async function zoneMaskCoverage(mask: Buffer): Promise<number> {
  const data = await sharp(mask).greyscale().extractChannel(0).raw().toBuffer();
  let sum = 0;
  for (const value of data) sum += value;
  return data.length ? sum / (data.length * 255) : 0;
}

/**
 * Diseño dentro de la zona, base estricta fuera. El borde se difumina para que
 * no se note la costura; lejos del borde, fuera de la zona, los píxeles son
 * exactamente los de la base.
 */
export async function compositeZoneImages(base: Buffer, design: Buffer, mask: Buffer): Promise<Buffer> {
  const { width, height } = await sharp(design).metadata();
  if (!width || !height) throw new Error('No se pudo leer el tamaño del diseño.');
  const sigma = Math.max(1.5, Math.max(width, height) * 0.006);
  const [basePixels, designPixels, maskPixels] = await Promise.all([
    sharp(base).resize(width, height, { fit: 'fill' }).removeAlpha().toColourspace('srgb').raw().toBuffer(),
    sharp(design).removeAlpha().toColourspace('srgb').raw().toBuffer(),
    sharp(mask).greyscale().extractChannel(0).resize(width, height, { fit: 'fill' }).blur(sigma).raw().toBuffer(),
  ]);
  const out = Buffer.allocUnsafe(designPixels.length);
  for (let pixel = 0, channel = 0; pixel < maskPixels.length; pixel++) {
    const weight = maskPixels[pixel]! / 255;
    for (let c = 0; c < 3; c++, channel++)
      out[channel] = Math.round(designPixels[channel]! * weight + basePixels[channel]! * (1 - weight));
  }
  return sharp(out, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
}

/**
 * Zonas permitidas garantizadas: una pasada base estricta y otra de diseño con
 * la misma cámara, compuestas con la máscara exacta del 3D. Si la zona no se ve
 * (o lo ocupa todo) basta una pasada y no se paga la otra.
 */
export async function generateZoneCompositeRender(input: {
  image: ImageAdapter;
  base: ImageGenRequest;
  design: ImageGenRequest;
  mask: Buffer;
}): Promise<Omit<ImageResult, 'cost'> & { zoneComposite: { mode: ZoneCompositeMode; coverage: number } }> {
  const coverage = Number((await zoneMaskCoverage(input.mask)).toFixed(4));
  if (coverage < ZONE_EMPTY_COVERAGE || coverage > ZONE_FULL_COVERAGE) {
    const mode: ZoneCompositeMode = coverage < ZONE_EMPTY_COVERAGE ? 'base_only' : 'design_only';
    const result = await input.image.generate(mode === 'base_only' ? input.base : input.design);
    return { ...result, zoneComposite: { mode, coverage } };
  }
  const [base, design] = await Promise.all([input.image.generate(input.base), input.image.generate(input.design)]);
  const [baseImage, designImage] = await Promise.all([readRenderReference(base), readRenderReference(design)]);
  const composite = await compositeZoneImages(
    Buffer.from(baseImage.base64, 'base64'), Buffer.from(designImage.base64, 'base64'), input.mask);
  const storage = getStorageAdapter();
  const assetKey = `renders/zones/${globalThis.crypto.randomUUID()}.jpg`;
  await storage.put({ key: assetKey, body: composite, contentType: 'image/jpeg' });
  return {
    assetUrl: await storage.getPresignedDownloadUrl(assetKey),
    assetKey,
    ...(design.generation ? { generation: design.generation } : {}),
    zoneComposite: { mode: 'two_pass', coverage },
  };
}
