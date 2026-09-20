import { sanitizeImageBuffer } from '@/server/ai/image/input-sanitizer';
import { MAX_IMAGE_BYTES } from '@/server/ai/call-limits';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import type { StudioImage } from '@/lib/studio-state';
import sharp from 'sharp';
import { toAspectRatio } from '@/server/agent/canvas/rasterize-canvas-doc';

export async function persistStudioSource(base64: string): Promise<StudioImage> {
  if (typeof base64 !== 'string' || base64.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4) {
    throw new Error('La imagen supera el tamaño máximo (10 MB).');
  }
  const image = await sanitizeImageBuffer(Buffer.from(base64, 'base64'));
  const key = `studio/${crypto.randomUUID()}.png`;
  const storage = getStorageAdapter();
  await storage.put({ key, body: Buffer.from(image.base64, 'base64'), contentType: 'image/png' });
  return { assetKey: key, assetUrl: await storage.getPresignedDownloadUrl(key) };
}

export async function readStudioImage(ref: StudioImage) {
  if (ref.assetKey) {
    const bytes = await getStorageAdapter().get(ref.assetKey);
    return withAspect(bytes.toString('base64'), 'image/png');
  }
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(ref.assetUrl);
  if (!match) throw new Error('No se pudo recuperar la imagen guardada.');
  return withAspect(match[2]!, match[1]!);
}

async function withAspect(base64: string, mimeType: string) {
  const meta = await sharp(Buffer.from(base64, 'base64')).metadata();
  return { base64, mimeType: meta.format ? `image/${meta.format}` : mimeType, aspectRatio: toAspectRatio(meta.width ?? 1, meta.height ?? 1) };
}
