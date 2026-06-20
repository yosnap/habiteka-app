'use server';

/**
 * Server Actions del media manager. Revalidan el rol admin, resuelven el
 * almacenamiento del entorno y delegan en las operaciones (que validan, sanean y
 * auditan). El almacenamiento real no se expone al cliente.
 */
import { requireAdmin } from '../guard';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { importFromUrl, deleteAsset } from './media-ops';
import { createFolder, moveFolder } from './folder-ops';
import { prisma } from '@/server/db/prisma';

export async function adminImportMediaFromUrl(url: string, folderId?: string) {
  const actor = await requireAdmin();
  return importFromUrl(getStorageAdapter(), { actorId: actor.userId, url, folderId });
}

export async function adminDeleteMedia(assetId: string) {
  const actor = await requireAdmin();
  await deleteAsset(getStorageAdapter(), actor.userId, assetId);
}

export async function adminCreateFolder(name: string, parentId?: string) {
  const actor = await requireAdmin();
  return createFolder(actor.userId, name, parentId);
}

export async function adminMoveFolder(folderId: string, newParentId: string | null) {
  const actor = await requireAdmin();
  await moveFolder(actor.userId, folderId, newParentId);
}

export async function adminListMedia(folderId?: string) {
  await requireAdmin();
  return prisma.mediaAsset.findMany({
    where: { folderId: folderId ?? null },
    select: { id: true, url: true, mime: true, width: true, height: true },
    orderBy: { createdAt: 'desc' },
  });
}
