'use server';
import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { assertEditorScope, type EditorScope } from '@/server/editor/authority';
import { prisma } from '@/server/db/prisma';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { DELIVERABLE_LEGAL_SEAL } from '@/lib/legal-text';
import { MAX_TOUR_SHOTS, tourDurationMs } from '@/lib/editor-document/image-tour';
import { signUploadTicket, readUploadTicket, assertVideoUpload } from './upload-ticket';

const MAX_BYTES = 100 * 1024 * 1024;

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error('No está configurada la firma de subidas');
  return value;
}

/** Autoriza la subida del MP4 de un montaje con imágenes generadas de este proyecto, ligado a un diseño aprobado. */
export async function prepareImageTourUpload(scope: EditorScope, approvalId: string, deliverableIds: string[], bytes: number) {
  const ctx = await requireOrgContext();
  if (!Number.isInteger(bytes) || bytes < 32 || bytes > MAX_BYTES) throw new Error('El vídeo supera el límite de 100 MB');
  if (!Array.isArray(deliverableIds) || !deliverableIds.length || deliverableIds.length > MAX_TOUR_SHOTS ||
    new Set(deliverableIds).size !== deliverableIds.length || deliverableIds.some((id) => typeof id !== 'string' || !id))
    throw new Error(`El montaje admite de 1 a ${MAX_TOUR_SHOTS} imágenes distintas.`);
  const approved = await withEditorDocuments(ctx).readApproval(scope, approvalId);
  const rows = await prisma.deliverable.findMany({ where: { id: { in: deliverableIds }, projectId: scope.projectId,
    project: { organizationId: ctx.organizationId }, type: 'RENDER_3D', deletedAt: null }, select: { id: true } });
  if (rows.length !== deliverableIds.length) throw new Error('Alguna imagen no pertenece a este proyecto.');
  const id = crypto.randomUUID(), key = `walkthrough-uploads/${ctx.organizationId}/${scope.projectId}/${id}.mp4`;
  const ticket = signUploadTicket({ id, key, organizationId: ctx.organizationId, userId: ctx.userId,
    projectId: scope.projectId, zoneId: scope.zoneId ?? null, routeId: 'images',
    approvalId: approved.id, approvedRevision: approved.revision, approvedFingerprint: approved.fingerprint, bytes,
    mode: 'images', sourceIds: deliverableIds, durationMs: tourDurationMs(deliverableIds.length), expires: Date.now() + 300000 }, secret());
  return { ticket, url: await getStorageAdapter().getPresignedUploadUrl(key, bytes, 'video/mp4') };
}

export async function finishImageTourUpload(token: string) {
  const ctx = await requireOrgContext(), ticket = readUploadTicket(token, secret());
  if (ticket.mode !== 'images' || !ticket.sourceIds?.length) throw new Error('El permiso no es de un montaje con imágenes.');
  if (ticket.organizationId !== ctx.organizationId || ticket.userId !== ctx.userId) throw new Error('Permiso de subida no válido para esta cuenta');
  const scope = { projectId: ticket.projectId, zoneId: ticket.zoneId };
  const approved = await withEditorDocuments(ctx).readApproval(scope, ticket.approvalId);
  if (approved.revision !== ticket.approvedRevision || approved.fingerprint !== ticket.approvedFingerprint)
    throw new Error('La versión aprobada del vídeo no coincide.');
  const storage = getStorageAdapter(), id = `video-${ticket.id}`;
  if (!storage.inspect || !storage.promote) throw new Error('El almacenamiento no admite verificación de vídeos');
  const existing = await prisma.deliverable.findFirst({ where: { id, projectId: ticket.projectId, project: { organizationId: ctx.organizationId }, deletedAt: null } });
  if (existing) return { id };
  const assetKey = `videos/${ctx.organizationId}/${ticket.projectId}/${ticket.id}.mp4`;
  try {
    const info = await storage.inspect(ticket.key);
    assertVideoUpload(info.bytes, ticket.bytes, info.contentType, info.header);
    await storage.promote(ticket.key, assetKey);
  } catch (error) {
    const final = await storage.inspect(assetKey).catch(() => { throw error; });
    assertVideoUpload(final.bytes, ticket.bytes, final.contentType, final.header);
  }
  await prisma.$transaction(async (tx) => {
    await assertEditorScope(tx, ctx, scope, { lock: true });
    if (await tx.deliverable.findUnique({ where: { id } })) return;
    await tx.deliverable.create({ data: { id, projectId: ticket.projectId, zoneId: ticket.zoneId, type: 'VIDEO',
      payload: { type: 'video', assetKey, mode: 'images', sourceDeliverableIds: ticket.sourceIds,
        approvalId: ticket.approvalId, approvedRevision: ticket.approvedRevision, approvedFingerprint: ticket.approvedFingerprint,
        durationMs: ticket.durationMs, width: 1920, height: 1080 },
      legalSeal: DELIVERABLE_LEGAL_SEAL } });
    await tx.usageEvent.create({ data: { userId: ctx.userId, orgId: ctx.organizationId, action: 'walkthrough.image-tour-export',
      unit: 'second', amount: Math.ceil(ticket.durationMs / 1000), cost: '0', refId: id } });
  });
  revalidatePath(`/projects/${ticket.projectId}/deliverables`);
  return { id };
}
