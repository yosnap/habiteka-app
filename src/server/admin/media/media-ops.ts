/**
 * Operaciones del media manager: importar una imagen por URL, registrar un asset
 * subido y borrar. Concentra la cadena segura: validar el destino (anti-SSRF),
 * descargar con límite, sanear el contenido, almacenar y registrar los metadatos,
 * respetando la cuota. El almacenamiento se inyecta para poder probar sin red.
 */
import { prisma } from '@/server/db/prisma';
import type { StorageAdapter } from '@/server/storage/storage-adapter';
import { assertSafeImportUrl } from './url-safety';
import { validateUpload } from './upload-validator';
import { assertWithinQuota } from './quota';
import { writeAudit } from '../audit';

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

export interface ImportInput {
  actorId: string;
  url: string;
  folderId?: string;
}

export interface MediaAssetResult {
  id: string;
  key: string;
}

/** Importa una imagen desde una URL externa de forma segura. */
export async function importFromUrl(
  storage: StorageAdapter,
  input: ImportInput,
): Promise<MediaAssetResult> {
  // 1) Validar el destino antes de tocar la red (anti-SSRF).
  assertSafeImportUrl(input.url);

  // 2) Descargar con timeout y leer un buffer acotado.
  const buffer = await fetchLimited(input.url);

  // 3) Sanear el contenido (magic bytes, dimensiones, EXIF, re-encode).
  const image = await validateUpload(buffer);

  // 4) Respetar la cuota antes de persistir.
  await assertWithinQuota(image.body.byteLength);

  // 5) Almacenar y registrar el metadato.
  const key = `media/${cryptoRandomKey()}.png`;
  await storage.put({ key, body: image.body, contentType: image.contentType });
  const url = await storage.getPresignedDownloadUrl(key);

  const asset = await prisma.mediaAsset.create({
    data: {
      folderId: input.folderId ?? null,
      key,
      url,
      mime: image.contentType,
      size: image.body.byteLength,
      width: image.width,
      height: image.height,
      status: 'READY',
      createdBy: input.actorId,
    },
    select: { id: true, key: true },
  });

  await writeAudit({
    actorId: input.actorId,
    action: 'import_media',
    targetType: 'media_asset',
    targetId: asset.id,
  });
  return asset;
}

/** Borra un asset del storage y su metadato. */
export async function deleteAsset(
  storage: StorageAdapter,
  actorId: string,
  assetId: string,
): Promise<void> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: { key: true },
  });
  if (!asset) return;
  await storage.delete(asset.key);
  await prisma.mediaAsset.delete({ where: { id: assetId } });
  await writeAudit({
    actorId,
    action: 'delete_media',
    targetType: 'media_asset',
    targetId: assetId,
  });
}

async function fetchLimited(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'error' });
    if (!res.ok) throw new Error(`La descarga devolvió ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_IMPORT_BYTES) {
      throw new Error('La imagen excede el tamaño máximo de importación');
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

function cryptoRandomKey(): string {
  return globalThis.crypto.randomUUID();
}
