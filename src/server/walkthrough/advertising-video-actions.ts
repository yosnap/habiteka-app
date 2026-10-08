'use server';
import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { assertEditorScope, type EditorScope } from '@/server/editor/authority';
import { prisma } from '@/server/db/prisma';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { DELIVERABLE_LEGAL_SEAL } from '@/lib/legal-text';
import { advertisingVideoSchema, type AdvertisingVideoOptions } from '@/lib/editor-document/advertising-video';
import { videoFormatSize } from '@/lib/editor-document/video-format';
import { signUploadTicket, readUploadTicket, assertVideoUpload } from './upload-ticket';
import { advertisingVideoSource } from './advertising-video-source';
import { fail, runAction } from '@/server/errors/run-action';
import { videoTitleSchema } from '@/lib/editor-document/video-title';

function secret() {
  const value = process.env.BETTER_AUTH_SECRET; if (!value) throw new Error('No está configurada la firma de subidas.'); return value;
}
/** Se resuelve el archivo en el servidor: no se acepta una URL proporcionada por el cliente. */
export async function loadAdvertisingVideo(scope: EditorScope, approvalId: string, sourceId: string) {
  return runAction(async () => {
    const source = await advertisingVideoSource(await requireOrgContext(), scope, approvalId, sourceId);
    return { url: source.url, measurements: source.measurements, durationMs: source.durationMs };
  });
}
export async function prepareAdvertisingUpload(scope: EditorScope, approvalId: string, sourceId: string, bytes: number, rawOptions: AdvertisingVideoOptions, title?: string) {
  return runAction(() => prepareAdvertisingUploadImpl(scope, approvalId, sourceId, bytes, rawOptions, title));
}
async function prepareAdvertisingUploadImpl(scope: EditorScope, approvalId: string, sourceId: string, bytes: number, rawOptions: AdvertisingVideoOptions, name?: string) {
  const ctx = await requireOrgContext(), options = advertisingVideoSchema.parse(rawOptions);
  const title = videoTitleSchema.parse(name);
  if (!Number.isInteger(bytes) || bytes < 32 || bytes > 100 * 1024 * 1024) fail('El anuncio supera el límite de 100 MB.');
  const source = await advertisingVideoSource(ctx, scope, approvalId, sourceId);
  if (options.dimensionMode !== 'none' && !source.measurements) fail('El diseño aprobado no tiene medidas disponibles. Elige Sin medidas.');
  const id = crypto.randomUUID(), key = `walkthrough-uploads/${ctx.organizationId}/${scope.projectId}/${id}.mp4`;
  const ticket = signUploadTicket({ id, key, organizationId: ctx.organizationId, userId: ctx.userId, projectId: scope.projectId,
    zoneId: scope.zoneId ?? null, routeId: 'advertising', approvalId, approvedRevision: source.approved.revision,
    approvedFingerprint: source.approved.fingerprint, bytes, mode: 'advertising', sourceIds: [sourceId],
    advertising: options, ...(title ? { title } : {}), durationMs: source.durationMs, expires: Date.now() + 300000 }, secret());
  return { ticket, url: await getStorageAdapter().getPresignedUploadUrl(key, bytes, 'video/mp4') };
}
export async function finishAdvertisingUpload(token: string) {
  return runAction(() => finishAdvertisingUploadImpl(token));
}
async function finishAdvertisingUploadImpl(token: string) {
  const ctx = await requireOrgContext(), ticket = readUploadTicket(token, secret());
  if (ticket.organizationId !== ctx.organizationId || ticket.userId !== ctx.userId || ticket.mode !== 'advertising' || ticket.sourceIds?.length !== 1)
    fail('Permiso de anuncio no válido para esta cuenta.');
  const scope = { projectId: ticket.projectId, zoneId: ticket.zoneId }, options = advertisingVideoSchema.parse(ticket.advertising);
  const source = await advertisingVideoSource(ctx, scope, ticket.approvalId, ticket.sourceIds[0]!);
  if (source.approved.revision !== ticket.approvedRevision || source.approved.fingerprint !== ticket.approvedFingerprint || source.durationMs !== ticket.durationMs)
    fail('La versión del clip ha cambiado. Vuelve a preparar el anuncio.');
  const id = `video-${ticket.id}`, storage = getStorageAdapter();
  if (!storage.inspect || !storage.promote) throw new Error('El almacenamiento no admite verificación de vídeos.');
  const existing = await prisma.deliverable.findFirst({ where: { id, projectId: ticket.projectId, deletedAt: null, project: { organizationId: ctx.organizationId } } });
  if (existing) return { id };
  const assetKey = `videos/${ctx.organizationId}/${ticket.projectId}/${ticket.id}.mp4`;
  try {
    const info = await storage.inspect(ticket.key); assertVideoUpload(info.bytes, ticket.bytes, info.contentType, info.header);
    await storage.promote(ticket.key, assetKey);
  } catch (error) {
    const final = await storage.inspect(assetKey).catch(() => { throw error; }); assertVideoUpload(final.bytes, ticket.bytes, final.contentType, final.header);
  }
  await prisma.$transaction(async tx => {
    await assertEditorScope(tx, ctx, scope, { lock: true });
    if (await tx.deliverable.findUnique({ where: { id } })) return;
    await tx.deliverable.create({ data: { id, projectId: ticket.projectId, zoneId: ticket.zoneId, type: 'VIDEO',
      payload: { type: 'video', mode: 'advertising', assetKey, sourceDeliverableIds: ticket.sourceIds, approvalId: ticket.approvalId,
        approvedRevision: ticket.approvedRevision, approvedFingerprint: ticket.approvedFingerprint, durationMs: ticket.durationMs,
        ...videoFormatSize(options.format), advertising: options, measurements: options.dimensionMode === 'none' || !source.measurements ? null : { ...source.measurements },
        dimensionPlacement: 'screen-panel', ...(ticket.title ? { title: videoTitleSchema.parse(ticket.title) } : {}) }, legalSeal: DELIVERABLE_LEGAL_SEAL } });
    await tx.usageEvent.create({ data: { userId: ctx.userId, orgId: ctx.organizationId, action: 'walkthrough.advertising-export',
      unit: 'second', amount: Math.ceil(ticket.durationMs / 1000), cost: '0', refId: id } });
  });
  revalidatePath(`/projects/${ticket.projectId}/deliverables`); return { id };
}
