import 'server-only';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { MAX_IMAGE_BYTES } from '@/server/ai/call-limits';
import { sanitizeOwnRenderBuffer } from '@/server/ai/image/input-sanitizer';
import { assertSafeImportUrl } from '@/server/admin/media/url-safety';
import { fail } from '@/server/errors/run-action';

const STORED_RENDER_DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

/** Bytes saneados de un render propio: del storage, de un data URL o de una URL segura. */
export async function readRenderReference(payload: { assetKey?: unknown; assetUrl?: unknown }) {
  if (typeof payload.assetKey === 'string' && payload.assetKey.length > 0)
    return sanitizeOwnRenderBuffer(await getStorageAdapter().get(payload.assetKey));
  if (typeof payload.assetUrl !== 'string') fail('El diseño de referencia no tiene una imagen recuperable.');
  const data = STORED_RENDER_DATA_URL.exec(payload.assetUrl);
  if (data?.[1] && data[2]) return sanitizeOwnRenderBuffer(Buffer.from(data[2], 'base64'));
  const url = assertSafeImportUrl(payload.assetUrl);
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) fail('No se pudo recuperar el diseño de referencia.');
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES)
    fail('El diseño de referencia excede el tamaño permitido.');
  if (!response.body) fail('No se pudo leer el diseño de referencia.');
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_IMAGE_BYTES) fail('El diseño de referencia excede el tamaño permitido.');
      chunks.push(Buffer.from(part.value));
    }
  } finally {
    reader.releaseLock();
  }
  return sanitizeOwnRenderBuffer(Buffer.concat(chunks, total));
}
