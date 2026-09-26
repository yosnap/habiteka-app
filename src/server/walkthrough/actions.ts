'use server';
import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { assertEditorScope, type EditorScope } from '@/server/editor/authority';
import { prisma } from '@/server/db/prisma';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { DELIVERABLE_LEGAL_SEAL } from '@/lib/legal-text';
import { buildWalkthrough } from '@/lib/editor-document/walkthrough-geometry';
import { nativeVideoDurationMs, type NativeVideoMode } from '@/lib/editor-document/native-video';
import { signUploadTicket, readUploadTicket, assertVideoUpload } from './upload-ticket';

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error('No está configurada la firma de subidas');
  return value;
}
export async function prepareWalkthroughUpload(scope: EditorScope, approvalId: string, routeId: string, bytes: number, mode: NativeVideoMode = 'walkthrough') {
  const ctx = await requireOrgContext();
  if (!Number.isInteger(bytes) || bytes < 32 || bytes > 100 * 1024 * 1024) throw new Error('El vídeo supera el límite de 100 MB');
  const approved = await withEditorDocuments(ctx).readApproval(scope, approvalId);
  const route = approved.document.walkthroughs?.find((path) => path.id === routeId);
  if (!route) throw new Error('El recorrido no pertenece al diseño aprobado. Aprueba una nueva versión.');
  const compiled = buildWalkthrough(approved.document, route);
  if (!['walkthrough', 'showcase'].includes(mode) || compiled.invalidSegments.length ||
    nativeVideoDurationMs(compiled.durationMs, mode) > 60000 || compiled.durationMs < 100) throw new Error('Recorrido no exportable');
  const id = crypto.randomUUID(), key = `walkthrough-uploads/${ctx.organizationId}/${scope.projectId}/${id}.mp4`;
  const ticket = signUploadTicket({ id, key, organizationId: ctx.organizationId, userId: ctx.userId,
    projectId: scope.projectId, zoneId: scope.zoneId ?? null, routeId,
    approvalId: approved.id, approvedRevision: approved.revision, approvedFingerprint: approved.fingerprint, bytes,
    mode, durationMs: nativeVideoDurationMs(compiled.durationMs, mode), expires: Date.now() + 300000 }, secret());
  return { ticket, url: await getStorageAdapter().getPresignedUploadUrl(key, bytes, 'video/mp4') };
}
export async function finishWalkthroughUpload(token: string) {
  const ctx = await requireOrgContext(), ticket = readUploadTicket(token, secret());
  if (ticket.organizationId !== ctx.organizationId || ticket.userId !== ctx.userId) throw new Error('Permiso de subida no válido para esta cuenta');
  const scope = { projectId: ticket.projectId, zoneId: ticket.zoneId };
  const approved = await withEditorDocuments(ctx).readApproval(scope, ticket.approvalId);
  if (approved.revision !== ticket.approvedRevision || approved.fingerprint !== ticket.approvedFingerprint ||
    !approved.document.walkthroughs?.some((p) => p.id === ticket.routeId)) throw new Error('La versión aprobada del vídeo no coincide.');
  const storage = getStorageAdapter(), id = `video-${ticket.id}`;
  if (!storage.inspect || !storage.promote) throw new Error('El almacenamiento no admite verificación de vídeos');
  const existing = await prisma.deliverable.findFirst({ where: { id, projectId: ticket.projectId, project: { organizationId: ctx.organizationId }, deletedAt: null } });
  if (existing) return { id };
  const assetKey = `videos/${ctx.organizationId}/${ticket.projectId}/${ticket.id}.mp4`;
  // Reintentar también después de promover el archivo si falló la transacción.
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
      payload: { type: 'video', assetKey, routeId: ticket.routeId, mode: ticket.mode ?? 'walkthrough',
        approvalId: ticket.approvalId, approvedRevision: ticket.approvedRevision, approvedFingerprint: ticket.approvedFingerprint,
        durationMs: ticket.durationMs, width: 1920, height: 1080 },
      legalSeal: DELIVERABLE_LEGAL_SEAL } });
    await tx.usageEvent.create({ data: { userId: ctx.userId, orgId: ctx.organizationId, action: 'walkthrough.native-export',
      unit: 'second', amount: Math.ceil(ticket.durationMs / 1000), cost: '0', refId: id } });
  });
  revalidatePath(`/projects/${ticket.projectId}/deliverables`);
  return { id };
}
