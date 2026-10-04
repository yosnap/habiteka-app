import sharp from 'sharp';
import type { ImageAdapter, ImageResult, InpaintRequest } from '@/lib/contracts';
import type { StorageAdapter } from '@/server/storage/storage-adapter';
import { isWholeImageZone, resolveZone } from '@/server/agent/feedback/zone-resolver';
import { imageEditMask } from './image-edit-mask';
import { inpaintWindow, zoneInWindow } from './inpaint-window';
import { MAX_OWN_RENDER_BYTES } from './input-sanitizer';
import { aiError } from '../errors';

const MAX_PIXELS = 24_000_000;
const DATA_IMAGE = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;

/**
 * Los detalles pequeños se envían con contexto cercano de la misma imagen.
 * La máscara guía al modelo; la conservación exterior la impone el servidor.
 * Se ejecuta fuera del failover: un fallo de composición no genera otra imagen.
 */
export async function protectedInpaint(
  image: ImageAdapter, request: InpaintRequest, storage?: StorageAdapter,
): Promise<ImageResult> {
  resolveZone(request.zone);
  if (isWholeImageZone(request.zone)) return image.inpaint({ ...request, editMask: undefined });
  const encoded = request.baseImage.base64 ?? DATA_IMAGE.exec(request.baseImage.url ?? '')?.[1];
  if (!encoded) throw aiError('sanitizer', 'Para retocar una zona se necesita la imagen guardada en el proyecto.');
  if (encoded.length > Math.ceil(MAX_OWN_RENDER_BYTES / 3) * 4)
    throw aiError('sanitizer', 'La imagen supera el tamaño permitido para el retoque.');
  const base = await decode(Buffer.from(encoded, 'base64'));
  const { width, height } = base.info;
  const mask = imageEditMask(request.zone, width, height);
  const window = inpaintWindow(request.zone, width, height);
  const cropped = window.width !== width || window.height !== height;
  const maskPng = await sharp(mask, { raw: { width, height, channels: 1 } }).extract(window).png().toBuffer();
  const originalPng = await sharp(base.data, { raw: { width, height, channels: 4 } }).extract(window).png().toBuffer();
  if (originalPng.byteLength > MAX_OWN_RENDER_BYTES)
    throw aiError('sanitizer', 'La referencia preparada supera el tamaño permitido para el retoque.');
  const result = await image.inpaint({
    ...request,
    zone: zoneInWindow(request.zone, window, width, height),
    baseImage: { base64: originalPng.toString('base64'), mimeType: 'image/png' },
    editMask: { base64: maskPng.toString('base64'), mimeType: 'image/png' },
    prompt: request.prompt + '\nREFERENCE 1 is ' + (cropped ? 'a close crop from the original image, including the selected detail and its surroundings' : 'the complete original image') +
      '. REFERENCE 2 is a binary edit mask aligned to reference 1: WHITE is the only editable area, BLACK must remain unchanged.' +
      ' Apply the requested correction inside WHITE. A report of a missing element requests restoring that element; do not return an unchanged copy.' +
      ' Return exactly the view in reference 1, with the same framing, aspect ratio, camera, lighting and scale. Do not reconstruct the full floor plan from a crop, change the viewpoint, add borders or render the mask. Preserve continuity at the mask boundary. If a requested change is outside WHITE, leave it unchanged.',
  });
  const candidate = await decode(await resultBytes(result, storage));
  const ratioError = Math.abs((candidate.info.width / candidate.info.height) / (window.width / window.height) - 1);
  if (ratioError > .005) throw aiError('sanitizer', 'El retoque cambió la proporción de la imagen. No se ha aplicado ni se ha repetido la generación; el original se conserva.');
  const pixels = candidate.info.width === window.width && candidate.info.height === window.height ? candidate.data
    : await sharp(candidate.data, { raw: { width: candidate.info.width, height: candidate.info.height, channels: 4 } })
      .resize(window.width, window.height, { fit: 'fill' }).raw().toBuffer();
  // Se parte de los bytes originales y se reemplazan SOLO los píxeles blancos.
  let editedPixels = 0;
  const output = Buffer.from(base.data);
  for (let pixel = 0; pixel < mask.length; pixel++) {
    if (mask[pixel] !== 255) continue;
    const x = pixel % width - window.left;
    const y = Math.floor(pixel / width) - window.top;
    const sourceOffset = (y * window.width + x) * 4;
    pixels.copy(output, pixel * 4, sourceOffset, sourceOffset + 4);
    editedPixels++;
  }
  const png = await sharp(output, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const asset = await persist(png, storage);
  return { ...result, assetKey: undefined, ...asset, regionEdit: { mode: 'original-pixels-v1', zone: request.zone,
    protectedPixels: mask.length - editedPixels, totalPixels: mask.length,
    ...(cropped ? { contextCrop: { x: window.left, y: window.top, width: window.width, height: window.height } } : {}) } };
}

async function decode(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_OWN_RENDER_BYTES) throw aiError('sanitizer', 'La imagen no tiene un tamaño válido para el retoque.');
  try {
    const image = sharp(bytes, { limitInputPixels: MAX_PIXELS });
    const meta = await image.metadata();
    if (!['png', 'jpeg', 'webp'].includes(meta.format ?? '') || (meta.pages ?? 1) !== 1 || !meta.width || !meta.height || meta.width > 8192 || meta.height > 8192)
      throw new Error('Formato o dimensiones no admitidos');
    return await image.rotate().toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  } catch {
    throw aiError('sanitizer', 'No se pudo leer la imagen para proteger la zona. El original se conserva.');
  }
}

async function resultBytes(result: ImageResult, storage?: StorageAdapter): Promise<Buffer> {
  if (result.assetKey && storage) return storage.get(result.assetKey);
  const encoded = DATA_IMAGE.exec(result.assetUrl)?.[1];
  if (encoded) return Buffer.from(encoded, 'base64');
  // Nunca descargar una URL arbitraria para componer el resultado en el servidor.
  throw aiError('sanitizer', 'No se pudo recuperar el retoque desde el almacenamiento. No se ha aplicado; el original se conserva.');
}

async function persist(bytes: Buffer, storage?: StorageAdapter): Promise<{ assetUrl: string; assetKey?: string }> {
  if (storage) {
    const assetKey = `renders/edits/${globalThis.crypto.randomUUID()}.png`;
    try {
      await storage.put({ key: assetKey, body: bytes, contentType: 'image/png' });
      return { assetKey, assetUrl: await storage.getPresignedDownloadUrl(assetKey) };
    } catch { /* El resultado ya pagado se conserva como data URL si falla el storage. */ }
  }
  return { assetUrl: `data:image/png;base64,${bytes.toString('base64')}` };
}
