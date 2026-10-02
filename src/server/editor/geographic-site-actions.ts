'use server';

import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { prisma } from '@/server/db/prisma';
import { runAction } from '@/server/errors/run-action';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { geographicLocationSchema, geographicSiteSchema } from '@/lib/editor-document/geographic-site';
import { orthophotoUrl } from '@/lib/editor-document/geographic-site';
import { assertEditorScope } from './authority';

export async function loadSiteOrthophoto(projectId: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireOrgContext();
    await prisma.$transaction(tx => assertEditorScope(tx, ctx, { projectId }));
    const location = geographicLocationSchema.parse(input);
    const response = await fetch(orthophotoUrl(location), {
      signal: AbortSignal.timeout(25000), redirect: 'error', cache: 'no-store',
    });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/jpeg'))
      throw new Error('IGN no ha devuelto una ortofoto. Vuelve a intentar cargarla.');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 8_000_000) throw new Error('La ortofoto supera el tamaño permitido.');
    const info = await sharp(bytes).metadata();
    if (info.format !== 'jpeg' || info.width !== 1440 || info.height !== 1440)
      throw new Error('La ortofoto no tiene las dimensiones esperadas.');
    const assetKey = `geographic-sites/${ctx.organizationId}/${projectId}/${randomUUID()}.jpg`;
    await getStorageAdapter().put({ key: assetKey, body: bytes, contentType: 'image/jpeg' });
    return { ...location, source: 'IGN-PNOA' as const, assetKey, capturedAt: new Date().toISOString(),
      url: await getStorageAdapter().getPresignedDownloadUrl(assetKey) };
  });
}

export async function resolveSiteOrthophoto(projectId: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireOrgContext();
    await prisma.$transaction(tx => assertEditorScope(tx, ctx, { projectId }));
    const site = geographicSiteSchema.parse(input);
    if (!site.assetKey.startsWith(`geographic-sites/${ctx.organizationId}/${projectId}/`))
      throw new Error('La ortofoto no pertenece a este proyecto.');
    return getStorageAdapter().getPresignedDownloadUrl(site.assetKey);
  });
}
